import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { createProduct, searchProducts, getProduct, getProductByBarcode, updateProduct, adjustStock, lowStockProducts } from '../services/productService.js';

export const productRouter = Router();

productRouter.post('/', asyncHandler(async (req, res) => {
  const product = await createProduct(req.body ?? {});
  return res.status(201).json({ product });
}));
productRouter.get('/', asyncHandler(async (req, res) => res.json(await searchProducts({ query: req.query.q, page: req.query }))));
productRouter.get('/low-stock', asyncHandler(async (req, res) => res.json({ items: await lowStockProducts() })));
productRouter.get('/barcode/:barcode', asyncHandler(async (req, res) => res.json({ product: await getProductByBarcode(req.params.barcode) })));
productRouter.get('/:id', asyncHandler(async (req, res) => res.json({ product: await getProduct(req.params.id) })));
productRouter.put('/:id', asyncHandler(async (req, res) => res.json({ product: await updateProduct(req.params.id, req.body ?? {}) })));
productRouter.post('/:id/stock', asyncHandler(async (req, res) => res.json({ product: await adjustStock(req.params.id, Number(req.body?.delta)) })));
