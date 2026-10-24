import mongoose from 'mongoose';

const auditRecordSchema = new mongoose.Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true, index: true },
  actionType: { type: String, enum: ['correction', 'cancellation'], required: true },
  previousValues: { type: mongoose.Schema.Types.Mixed },
  updatedValues: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  timestamp: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

export const AuditRecord = mongoose.model('AuditRecord', auditRecordSchema);
