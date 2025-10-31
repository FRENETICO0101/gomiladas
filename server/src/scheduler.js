import cron from 'node-cron';
import { getClient } from './whatsappBot.js';
import { customersStore, ordersStore } from './stores/orders.js';
import { config } from './config.js';
import { ordersRepo } from './stores/orders.js';

export function startScheduler() {
  // Enviar promo semanal (configurable por CRON)
  cron.schedule(config.PROMO_CRON, async () => {
    const text = 'Promo semanal de Gomitas: 2x1 en Mix Frutal hoy!';
    await sendPromotionToAll(text);
  });

  // Seguimiento postventa: cada hora busca pedidos entregados hace >24h sin seguimiento
  cron.schedule('15 * * * *', async () => {
    try {
      const client = getClient();
      if (!client) return;
      const orders = await ordersStore.read();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const candidates = orders.filter(o => o.status === 'delivered' && o.customer?.phone && o.deliveredAt && !o.postFollowupSent && (now - new Date(o.deliveredAt).getTime()) >= dayMs);
      for (const o of candidates) {
        const jid = `${o.customer.phone}@c.us`;
        const name = o.customer.name || 'cliente';
        const msg = `💬 ¿Qué te parecieron las gomitas, ${name}?\n`+
          `Tu opinión nos ayuda a mejorar.\n`+
          `Puedes calificar el servicio respondiendo con un número del 1 al 5 (5 = excelente).`;
        try {
          await client.sendMessage(jid, msg);
          await ordersRepo.update(o.id, { postFollowupSent: true, postFollowupAt: new Date().toISOString() });
        } catch (_) {}
      }
    } catch (e) {
      console.error('Error en seguimiento postventa:', e?.message || e);
    }
  });
}

export async function sendPromotionToAll(text) {
  const client = getClient();
  if (!client) return;
  const customers = await customersStore.read();
  for (const c of customers) {
    if (!c.phone) continue;
    const jid = c.phone.includes('@c.us') ? c.phone : `${c.phone}@c.us`;
    try { await client.sendMessage(jid, text); } catch (_) {}
  }
}
