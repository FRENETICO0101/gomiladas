import express from 'express';
import { ordersRepo } from '../stores/orders.js';
import { menu } from '../menu.js';
import { config } from '../config.js';
import { sendPromotionToAll } from '../scheduler.js';
import { genOrderId } from '../ids.js';
import { getClient } from '../whatsappBot.js';

export const api = express.Router();

api.get('/orders', async (req, res) => {
  const orders = await ordersRepo.list();
  res.json(orders);
});

// Public menu for web ordering UI
api.get('/menu', async (req, res) => {
  const visibleCats = (menu.categories || []).filter(c => !c.seasonal || config.HALLOWEEN_ENABLED);
  res.json({
    categories: visibleCats,
    chamoyOptions: menu.chamoyOptions || [],
  });
});

// Public order creation (customer-facing web form)
api.post('/orders', async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.customer || !p.customer.phone || !Array.isArray(p.items) || p.items.length === 0) {
      return res.status(400).json({ error: 'customer{ name, phone } and items[] required' });
    }
    const total = (p.items || []).reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    const order = {
      id: (p.id && String(p.id).toUpperCase()) || genOrderId(),
      status: 'new',
      createdAt: new Date().toISOString(),
      customer: { id: p.customer.id, name: p.customer.name, phone: p.customer.phone },
      items: p.items,
      total,
      note: p.note,
      source: 'web',
    };
    await ordersRepo.create(order);
    req.app.get('io').emit('orders:update', { type: 'created', order });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['new', 'preparing', 'done'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updated = await ordersRepo.updateStatus(req.params.id, status);
    req.app.get('io').emit('orders:update', { type: 'updated', order: updated });
    // Notify customer via WhatsApp when the order is ready
    if (status === 'done' && updated?.customer?.phone) {
      const client = getClient();
      if (client) {
        const digits = String(updated.customer.phone).replace(/\D/g, '');
        const chatId = `${digits}@c.us`;
        const customerName = updated.customer.name || 'cliente';
        const totalTxt = typeof updated.total === 'number' ? ` — Total: $${updated.total.toFixed(2)}` : '';
        const text = `Hola ${customerName}, tu pedido #${updated.id} está listo${totalTxt}.\nResponde este mensaje para coordinar la entrega. ¡Gracias por tu compra!`;
        try {
          await client.sendMessage(chatId, text);
        } catch (e) {
          console.error('No se pudo notificar por WhatsApp:', e?.message || e);
        }
      }
    }
    res.json(updated);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// Delete an order (only if done)
api.delete('/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const list = await ordersRepo.list();
    const ord = list.find(o => o.id === id);
    if (!ord) return res.status(404).json({ error: 'Order not found' });
    if (ord.status !== 'done') return res.status(400).json({ error: 'Only done orders can be deleted' });
    const removed = await ordersRepo.remove(id);
    req.app.get('io').emit('orders:update', { type: 'deleted', id });
    res.json({ ok: true, id: removed.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/promotions/send-now', async (req, res) => {
  const { text } = req.body || {};
  if (!text || text.length < 3) return res.status(400).json({ error: 'Text required' });
  await sendPromotionToAll(text);
  res.json({ ok: true });
});
