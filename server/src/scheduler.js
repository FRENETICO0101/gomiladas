import cron from 'node-cron';
import { getClient } from './whatsappBot.js';
import { customersStore } from './stores/orders.js';
import { config } from './config.js';

export function startScheduler() {
  // Enviar promo semanal (configurable por CRON)
  cron.schedule(config.PROMO_CRON, async () => {
    const text = 'Promo semanal de Gomitas: 2x1 en Mix Frutal hoy!';
    await sendPromotionToAll(text);
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
