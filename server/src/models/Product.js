import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
  barcode: { type: String, trim: true, unique: true, sparse: true, index: true },
  category: { type: String, trim: true, default: 'General' },
  pricePaise: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, min: 0, default: 5 },
  discountEligible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

export const Product = mongoose.model('Product', productSchema);
