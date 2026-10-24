export class AppError extends Error {
  constructor(status, message, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE_RESOURCE', message: 'A record with those unique details already exists.' } });
  }
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.message } });
  }
  const status = error.status ?? 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: { code: error.code ?? 'INTERNAL_ERROR', message: status >= 500 ? 'Internal server error' : error.message } });
};
