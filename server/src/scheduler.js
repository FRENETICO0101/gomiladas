import cron from 'node-cron';
import { getClient } from './whatsappBot.js';
import { customersStore, ordersStore } from './stores/orders.js';
import { config } from './config.js';
import { ordersRepo } from './stores/orders.js';

export function startScheduler() {
  // Automations disabled as requested: no scheduled promos or post-delivery follow-ups
  console.log('Scheduler: promos y seguimiento postventa desactivados.');
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
