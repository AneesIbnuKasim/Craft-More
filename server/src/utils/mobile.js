export const normalizeMobileNumber = (value) => {
  if (typeof value !== 'string') throw new Error('Mobile number must be a string');
  const digits = value.replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^\d{10}$/.test(normalized) || /^[01]/.test(normalized)) {
    throw new Error('Mobile number must contain a valid 10-digit Indian number');
  }
  return normalized;
};
