export const toPaise = (rupees) => {
  const value = Number(rupees);
  if (!Number.isFinite(value) || value < 0) return null;
  const paise = Math.round(value * 100);
  return Number.isSafeInteger(paise) ? paise : null;
};

export const formatRupees = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(paise) / 100);
export const formatDate = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';
export const todayInput = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
export const currentPeriod = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date());
