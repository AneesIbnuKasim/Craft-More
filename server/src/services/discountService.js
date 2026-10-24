export const discountPercentageForEligiblePaise = (eligiblePaise) => {
  if (!Number.isInteger(eligiblePaise) || eligiblePaise < 0) throw new Error('Eligible amount must be a non-negative integer number of paise');
  if (eligiblePaise >= 400000) return 15;
  if (eligiblePaise >= 250000) return 12;
  if (eligiblePaise >= 150000) return 8;
  return 0;
};

export const calculateBillAmounts = ({ eligibleProductAmount, excludedProductAmount, discountPercentage }) => {
  if (![eligibleProductAmount, excludedProductAmount].every((value) => Number.isInteger(value) && value >= 0)) throw new Error('Amounts must be non-negative integer paise values');
  if (![0, 8, 12, 15].includes(discountPercentage)) throw new Error('Invalid discount percentage');
  const grossTotal = eligibleProductAmount + excludedProductAmount;
  const discountAmount = Math.round(eligibleProductAmount * discountPercentage / 100);
  return { grossTotal, discountAmount, finalPayableAmount: grossTotal - discountAmount };
};
