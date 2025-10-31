import path from 'path';
import { DataStore } from '../db.js';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersPath = path.resolve(config.DATA_DIR, 'orders.json');
const customersPath = path.resolve(config.DATA_DIR, 'customers.json');

export const ordersStore = new DataStore(ordersPath, []);
export const customersStore = new DataStore(customersPath, []);

export async function initStores() {
  await ordersStore.init();
  await customersStore.init();
}

export const ordersRepo = {
  async list() {
    return ordersStore.read();
  },

  async create(order) {
    return ordersStore.queue(async () => {
      const orders = await ordersStore.read();
      orders.unshift(order);
      await ordersStore.write(orders);
      // ensure customer
      const customers = await customersStore.read();
      if (!customers.find(c => c.phone === order.customer.phone)) {
        customers.unshift({ id: order.customer.id, name: order.customer.name, phone: order.customer.phone });
        await customersStore.write(customers);
      }
      return order;
    });
  },

  async updateStatus(id, status) {
    return ordersStore.queue(async () => {
      const orders = await ordersStore.read();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) throw new Error('Order not found');
      const nowIso = new Date().toISOString();
      orders[idx].status = status;
      orders[idx].updatedAt = nowIso;
      if (status === 'delivered' && !orders[idx].deliveredAt) {
        orders[idx].deliveredAt = nowIso;
      }
      await ordersStore.write(orders);
      return orders[idx];
    });
  },

  async update(id, patch) {
    return ordersStore.queue(async () => {
      const orders = await ordersStore.read();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) throw new Error('Order not found');
      orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
      await ordersStore.write(orders);
      return orders[idx];
    });
  },

  async remove(id) {
    return ordersStore.queue(async () => {
      const orders = await ordersStore.read();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) throw new Error('Order not found');
      const removed = orders.splice(idx, 1)[0];
      await ordersStore.write(orders);
      return removed;
    });
  },
};
