import { Product } from '../models/Product.js';
import { AppError } from '../utils/http.js';

const pageSize = (value) => Math.min(Math.max(Number.parseInt(value ?? '20', 10) || 20, 1), 100);

export const createProduct = async ({ name, sku, barcode, category, pricePaise, stock, lowStockThreshold, discountEligible }) => {
  if (typeof name !== 'string' || name.trim().length < 1) throw new AppError(400, 'Product name required', 'INVALID_NAME');
  if (typeof sku !== 'string' || sku.trim().length < 1) throw new AppError(400, 'SKU required', 'INVALID_SKU');
  if (!Number.isInteger(pricePaise) || pricePaise < 0) throw new AppError(400, 'pricePaise must be non-negative integer', 'INVALID_PRICE');
  if (!Number.isInteger(stock ?? 0) || (stock ?? 0) < 0) throw new AppError(400, 'stock must be non-negative integer', 'INVALID_STOCK');
  try {
    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode?.trim() || undefined,
      category: category?.trim() || 'General',
      pricePaise,
      stock: stock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 5,
      discountEligible: discountEligible !== false
    });
    return product;
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, 'SKU or barcode already exists', 'DUPLICATE_PRODUCT');
    throw error;
  }
};

export const searchProducts = async ({ query, page }) => {
  const filter = {};
  if (query?.trim()) {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const conditions = [{ name: { $regex: escaped, $options: 'i' } }, { sku: { $regex: escaped, $options: 'i' } }];
    if (query.trim()) conditions.push({ barcode: { $regex: escaped, $options: 'i' } });
    filter.$or = conditions;
  }
  const limit = pageSize(page?.limit);
  const currentPage = Math.max(Number.parseInt(page?.page ?? '1', 10) || 1, 1);
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip((currentPage - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  return { items, page: currentPage, limit, total };
};

export const getProduct = async (id) => {
  const p = await Product.findById(id).lean();
  if (!p) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  return p;
};

export const getProductByBarcode = async (barcode) => {
  const p = await Product.findOne({ barcode: barcode?.trim() }).lean();
  if (!p) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  return p;
};

export const updateProduct = async (id, changes) => {
  const update = {};
  if (changes.name !== undefined) update.name = String(changes.name).trim();
  if (changes.sku !== undefined) update.sku = String(changes.sku).trim().toUpperCase();
  if (changes.barcode !== undefined) update.barcode = changes.barcode?.trim() || null;
  if (changes.category !== undefined) update.category = String(changes.category).trim();
  if (changes.pricePaise !== undefined) {
    if (!Number.isInteger(changes.pricePaise) || changes.pricePaise < 0) throw new AppError(400, 'pricePaise must be non-negative integer', 'INVALID_PRICE');
    update.pricePaise = changes.pricePaise;
  }
  if (changes.stock !== undefined) {
    if (!Number.isInteger(changes.stock) || changes.stock < 0) throw new AppError(400, 'stock must be non-negative integer', 'INVALID_STOCK');
    update.stock = changes.stock;
  }
  if (changes.lowStockThreshold !== undefined) update.lowStockThreshold = changes.lowStockThreshold;
  if (changes.discountEligible !== undefined) update.discountEligible = !!changes.discountEligible;
  update.updatedAt = new Date();
  try {
    const p = await Product.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!p) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
    return p;
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, 'SKU or barcode already exists', 'DUPLICATE_PRODUCT');
    throw error;
  }
};

export const adjustStock = async (id, delta) => {
  if (!Number.isInteger(delta)) throw new AppError(400, 'delta must be integer', 'INVALID_DELTA');
  const p = await Product.findById(id);
  if (!p) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  const newStock = p.stock + delta;
  if (newStock < 0) throw new AppError(409, 'Insufficient stock', 'INSUFFICIENT_STOCK');
  p.stock = newStock;
  p.updatedAt = new Date();
  await p.save();
  return p;
};

export const lowStockProducts = async () => {
  return Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).sort({ stock: 1 }).lean();
};
