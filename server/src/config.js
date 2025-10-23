import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
dotenv.config();

function getLocalIPv4() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const net of ifaces[name] || []) {
        if (net && net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch {}
  return 'localhost';
}

const DEFAULT_WEB_PORT = parseInt(process.env.WEB_PORT || '5173', 10);
const DEFAULT_API_PORT = parseInt(process.env.PORT || '3001', 10);
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const DEFAULT_BASE = `http://${getLocalIPv4()}:${isProd ? DEFAULT_API_PORT : DEFAULT_WEB_PORT}`;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || DEFAULT_BASE;

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  PROMO_CRON: process.env.PROMO_CRON || '0 12 * * 1', // Lunes 12:00
  DATA_DIR: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
  HALLOWEEN_ENABLED: (process.env.HALLOWEEN_ENABLED || 'true').toLowerCase() !== 'false',
  WEB_PORT: DEFAULT_WEB_PORT,
  PUBLIC_BASE_URL,
  PUBLIC_ORDER_URL: `${PUBLIC_BASE_URL}/order`,
};
