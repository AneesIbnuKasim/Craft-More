import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  type: { type: String, enum: ['sale', 'cancellation', 'adjustment', 'return'], required: true },
  quantity: { type: Number, required: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
  reason: { type: String, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
