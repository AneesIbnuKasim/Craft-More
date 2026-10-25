import { Bill } from '../models/Bill.js';
import { Customer } from '../models/Customer.js';
import { customerTotals } from './billService.js';
import { discountPercentageForEligiblePaise } from './discountService.js';
import { dayKey, monthKey } from '../utils/dates.js';
import { AppError } from '../utils/http.js';

const period = (value, fallback) => {
  const result = value ?? fallback;
  if (!/^\d{4}-\d{2}$/.test(result)) throw new AppError(400, 'period must use YYYY-MM format', 'INVALID_PERIOD');
  const [year, month] = result.split('-').map(Number);
  if (month < 1 || month > 12 || year < 1970 || year > 9999) throw new AppError(400, 'period must use a valid month and year', 'INVALID_PERIOD');
  return result;
};

const salesAggregate = async (match) => {
  const [result] = await Bill.aggregate([{ $match: { ...match, status: 'valid' } }, { $group: { _id: null, validBills: { $sum: 1 }, eligibleProductSales: { $sum: '$eligibleProductAmount' }, grossSales: { $sum: '$grossTotal' }, totalDiscounts: { $sum: '$discountAmount' }, netSales: { $sum: '$finalPayableAmount' } } }]);
  const totals = result ?? { validBills: 0, eligibleProductSales: 0, grossSales: 0, totalDiscounts: 0, netSales: 0 };
  return { ...totals, excludedProductSales: totals.grossSales - totals.eligibleProductSales };
};

export const dashboardSummary = async (timeZone, now = new Date()) => {
  const currentPeriod = monthKey(now, timeZone); const today = dayKey(now, timeZone);
  const [todaySales, currentSales, customerCount, previousByCustomer] = await Promise.all([
    Bill.aggregate([{ $match: { status: 'valid' } }, { $addFields: { storeDay: { $dateToString: { format: '%Y-%m-%d', date: '$billDate', timezone: timeZone } } } }, { $match: { storeDay: today } }, { $group: { _id: null, gross: { $sum: '$grossTotal' }, net: { $sum: '$finalPayableAmount' } } }]),
    salesAggregate({ reportingMonth: currentPeriod }),
    Customer.countDocuments(),
    Bill.aggregate([{ $match: { status: 'valid' } }, { $group: { _id: '$customerId', period: { $push: { month: '$reportingMonth', amount: '$eligibleProductAmount' } } } }])
  ]);
  const previous = monthKey(new Date(Date.UTC(Number(currentPeriod.slice(0, 4)), Number(currentPeriod.slice(5)) - 2, 1)), 'UTC');
  const tiers = { noDiscount: 0, eightPercent: 0, twelvePercent: 0, fifteenPercent: 0 };
  for (const item of previousByCustomer) {
    const eligible = item.period.filter(({ month }) => month === previous).reduce((sum, { amount }) => sum + amount, 0);
    const discount = discountPercentageForEligiblePaise(eligible);
    if (discount === 15) tiers.fifteenPercent += 1; else if (discount === 12) tiers.twelvePercent += 1; else if (discount === 8) tiers.eightPercent += 1; else tiers.noDiscount += 1;
  }
  tiers.noDiscount += Math.max(customerCount - previousByCustomer.length, 0);
  return { date: today, period: currentPeriod, today: { grossPurchases: todaySales[0]?.gross ?? 0, netSales: todaySales[0]?.net ?? 0 }, currentMonth: currentSales, registeredCustomers: customerCount, discountTiers: tiers };
};

export const monthlySalesReport = async (query, timeZone) => ({ period: period(query.period, monthKey(new Date(), timeZone)), ...(await salesAggregate({ reportingMonth: period(query.period, monthKey(new Date(), timeZone)) })) });

export const customerReport = async (query, timeZone) => {
  const customers = await Customer.find({}).sort({ name: 1 }).lean();
  const selectedPeriod = query.period ? period(query.period, monthKey(new Date(), timeZone)) : undefined;
  const rows = await Promise.all(customers.map(async (customer) => {
    const totals = await customerTotals(customer._id, timeZone, selectedPeriod ? new Date(`${selectedPeriod}-15T12:00:00Z`) : new Date());
    return { customerId: customer.customerId, name: customer.name, mobileNumber: customer.mobileNumber, lifetimePurchases: totals.lifetimePurchases, lifetimeDiscounts: totals.lifetimeDiscounts, currentDiscountPercentage: discountPercentageForEligiblePaise(totals.previousMonthEligiblePurchases), currentMonthEligiblePurchases: totals.currentMonthEligiblePurchases };
  }));
  return { period: selectedPeriod ?? monthKey(new Date(), timeZone), items: rows };
};

export const discountReport = async (query, timeZone) => {
  const selectedPeriod = query.period ? period(query.period, monthKey(new Date(), timeZone)) : undefined;
  const match = { status: 'valid' }; if (selectedPeriod) match.reportingMonth = selectedPeriod;
  const byTier = await Bill.aggregate([{ $match: match }, { $group: { _id: '$discountPercentage', billCount: { $sum: 1 }, totalDiscountAmount: { $sum: '$discountAmount' } } }, { $sort: { _id: 1 } }]);
  const byMonth = await Bill.aggregate([{ $match: match }, { $group: { _id: '$reportingMonth', billCount: { $sum: 1 }, totalDiscountAmount: { $sum: '$discountAmount' } } }, { $sort: { _id: 1 } }]);
  const bills = await Bill.find(match).select('billNumber billDate customerId eligibleProductAmount discountPercentage discountAmount finalPayableAmount').populate('customerId', 'customerId name').sort({ billDate: -1 }).lean();
  return { period: selectedPeriod ?? null, byTier, byMonth, bills };
};
