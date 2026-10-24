import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  normalizedMobileNumber: { type: String, required: true, unique: true, index: true },
  mobileNumber: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

customerSchema.index({ name: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
