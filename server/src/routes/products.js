import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { createProduct, searchProducts, getProduct, getProductByBarcode, updateProduct, adjustStock, lowStockProducts, getLabelData, batchLabels } from '../services/productService.js';

export const productRouter = Router();

productRouter.post('/', asyncHandler(async (req, res) => {
  const product = await createProduct(req.body ?? {});
  return res.status(201).json({ product });
}));
productRouter.get('/', asyncHandler(async (req, res) => res.json(await searchProducts({ query: req.query.q, page: req.query }))));
productRouter.get('/low-stock', asyncHandler(async (req, res) => res.json({ items: await lowStockProducts() })));
productRouter.get('/barcode/:barcode', asyncHandler(async (req, res) => res.json({ product: await getProductByBarcode(req.params.barcode) })));
productRouter.get('/:id', asyncHandler(async (req, res) => res.json({ product: await getProduct(req.params.id) })));
productRouter.get('/:id/label', asyncHandler(async (req, res) => res.json({ label: await getLabelData(req.params.id) })));
productRouter.post('/labels', asyncHandler(async (req, res) => res.json({ labels: await batchLabels(req.body?.items ?? []) })));
productRouter.put('/:id', asyncHandler(async (req, res) => res.json({ product: await updateProduct(req.params.id, req.body ?? {}) })));
productRouter.post('/:id/stock', asyncHandler(async (req, res) => res.json({ product: await adjustStock(req.params.id, Number(req.body?.delta)) })));
