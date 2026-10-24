export const monthKey = (date, timeZone = 'Asia/Kolkata') => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}`;
};

export const previousMonthKey = (date, timeZone) => {
  const [year, month] = monthKey(date, timeZone).split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return monthKey(previous, 'UTC');
};
