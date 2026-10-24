import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  billDate: { type: Date, required: true, index: true },
  reportingMonth: { type: String, required: true, index: true },
  eligibleProductAmount: { type: Number, required: true, min: 0 },
  excludedProductAmount: { type: Number, required: true, min: 0 },
  grossTotal: { type: Number, required: true, min: 0 },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  discountAmount: { type: Number, required: true, min: 0 },
  finalPayableAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['valid', 'cancelled'], default: 'valid', index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  requestHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

billSchema.index({ customerId: 1, billDate: -1 });

export const Bill = mongoose.model('Bill', billSchema);
