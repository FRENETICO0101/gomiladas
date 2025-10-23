import express from 'express';
import { ordersRepo } from '../stores/orders.js';
import { sendPromotionToAll } from '../scheduler.js';
import { genOrderId } from '../ids.js';

export const webhooks = express.Router();

// Crea una orden desde n8n o servicios externos
webhooks.post('/order', async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.customer || !p.items) return res.status(400).json({ error: 'customer and items required' });
    const order = {
      id: (p.id && String(p.id).toUpperCase()) || genOrderId(),
      status: 'new',
      createdAt: new Date().toISOString(),
      customer: p.customer,
      items: p.items,
      note: p.note,
    };
    await ordersRepo.create(order);
    req.app.get('io').emit('orders:update', { type: 'created', order });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dispara una promoción inmediata
webhooks.post('/promo', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  await sendPromotionToAll(text);
  res.json({ ok: true });
});
