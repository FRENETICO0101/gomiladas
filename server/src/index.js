import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStores } from './stores/orders.js';
import { initBot, attachIO } from './whatsappBot.js';
import { startScheduler } from './scheduler.js';
import { api } from './routes/api.js';
import { webhooks } from './routes/webhooks.js';

async function main() {
  console.log('DATA_DIR =', config.DATA_DIR);
  await initStores();

  const app = express();
  const server = http.createServer(app);
  const { Server } = await import('socket.io');
  const io = new Server(server, { cors: { origin: '*' } });

  app.set('io', io);
  attachIO(io);

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', api);
  app.use('/webhook', webhooks);

  // Serve built web app (production)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distDir = path.resolve(__dirname, '..', '..', 'web', 'dist');
  app.use(express.static(distDir));
  // History API fallback for SPA routes like /order
  app.get(['/', '/order', '/order/*'], (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  server.listen(config.PORT, () => {
    console.log(`API escuchando en http://localhost:${config.PORT}`);
  });

  initBot();
  startScheduler();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
