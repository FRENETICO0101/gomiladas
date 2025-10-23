import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { menu, formatMainMenu, formatPresentations, formatItems, formatChamoy } from './menu.js';
import { config } from './config.js';
import { ordersRepo } from './stores/orders.js';
import { genOrderId } from './ids.js';
import { getSession, resetSession, setSession, addToCart, cartTotal, clearCart, cartItemCount } from './sessions.js';
import { normalize } from './parsers.js';
import path from 'path';

function findPresentationByType(typeToken) {
  const token = normalize(typeToken);
  const matches = [];
  menu.categories.forEach((c, ci) => {
    (c.presentations||[]).forEach((p, pi) => {
      const names = [p.name, p.type].filter(Boolean).map(normalize);
      if (names.some(n => token.includes(n) || n.includes(token))) {
        matches.push({ catIdx: ci, presIdx: pi });
      }
    });
  });
  return matches;
}

function findItemInPresentation(pres, token) {
  const t = normalize(token);
  const idx = (pres.items||[]).findIndex(it => normalize(it.name).includes(t) || t.includes(normalize(it.name)));
  return idx;
}

function parseQty(text) {
  const m1 = text.match(/x\s*(\d+)/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = text.trim().match(/(\d+)(?!.*\d)/); // último número
  if (m2) return parseInt(m2[1], 10);
  return 1;
}

function parseChamoyList(text) {
  const afterQty = text.split(/x\s*\d+/i).pop();
  if (!afterQty) return [];
  const raw = afterQty.split(/[,:\n]/).map(s => s.trim()).filter(Boolean);
  const opts = menu.chamoyOptions.map(normalize);
  const mapped = raw
    .map(r => normalize(r))
    .map(r => {
      // Aliases primero (ej. clasico -> normal)
      if (menu.chamoyAliases && menu.chamoyAliases[r]) return menu.chamoyAliases[r];
      const i = opts.findIndex(o => o.startsWith(r) || r.startsWith(o));
      return i >= 0 ? menu.chamoyOptions[i] : null;
    })
    .filter(Boolean);
  return mapped;
}

async function tryExpressOrder(msg, name, from) {
  const text = (msg.body||'').trim();
  const low = normalize(text);
  const isAhogadas = /ahogada/.test(low) || /ahogadas/.test(low);
  const isEnchiladas = /enchilada/.test(low) || /enchiladas/.test(low);
  if (!isAhogadas && !isEnchiladas) return false; // no tipo → no express

  const presType = isAhogadas ? 'ahogadas' : 'enchiladas';
  const presCandidates = findPresentationByType(presType);
  if (!presCandidates.length) return false;

  // Busca el nombre del producto dentro del texto
  let chosen = null;
  for (const cand of presCandidates) {
    const pres = menu.categories[cand.catIdx].presentations[cand.presIdx];
    for (let i = 0; i < pres.items.length; i++) {
      const it = pres.items[i];
      if (low.includes(normalize(it.name))) {
        chosen = { ...cand, itemIdx: i };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) return false;

  const qty = parseQty(text);
  const pres = menu.categories[chosen.catIdx].presentations[chosen.presIdx];
  const product = pres.items[chosen.itemIdx];

  if (pres.type === 'ahogadas') {
    const list = parseChamoyList(text);
    if (list.length > 0) {
      // Distribuye chamoy segun lista
      const counts = {};
      for (let i = 0; i < qty; i++) {
        const ch = list[i % list.length];
      }
      Object.entries(counts).forEach(([ch, n]) => {
        addToCart(from, { name: product.name, price: product.price, quantity: n, presentation: pres.name, weight: pres.weight, type: pres.type, chamoy: ch });
      });
      const parts = Object.entries(counts).map(([k, v]) => `${v} con ${k}`);
      const sNow = getSession(from);
      const summary = `Carrito: ${cartItemCount(sNow.cart)} producto(s) — Total $${cartTotal(sNow.cart).toFixed(2)}`;
      await msg.reply(`Agregado: ${qty} x ${product.name} (${pres.name} ${pres.weight}) — ${parts.join(', ')} — $${(product.price*qty).toFixed(2)}\n${summary}\n\nEscribe "ver" para carrito o "finalizar".`);
      return true;
    } else {
      // Sin lista → preguntar multi-step
      setSession(from, { state: 'choosingChamoyMulti', pendingMulti: { idx: chosen.itemIdx, qtyTotal: qty, qtyDone: 0, counts: {} } , catIdx: chosen.catIdx, presIdx: chosen.presIdx});
      await msg.reply(formatChamoy(1, qty));
      return true;
    }
  } else {
    // Enchiladas → agregar directo
    addToCart(from, { name: product.name, price: product.price, quantity: qty, presentation: pres.name, weight: pres.weight, type: pres.type });
    const sNow = getSession(from);
    const summary = `Carrito: ${cartItemCount(sNow.cart)} producto(s) — Total $${cartTotal(sNow.cart).toFixed(2)}`;
    await msg.reply(`Agregado: ${qty} x ${product.name} (${pres.name} ${pres.weight}) $${(product.price*qty).toFixed(2)}\n${summary}\n\nEscribe "ver" para carrito o "finalizar".`);
    return true;
  }
}

let client;
let ioRef = null;

export function getClient() {
  return client;
}

export function attachIO(io) { ioRef = io; }

export function initBot() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'gomitas-bot', dataPath: path.resolve(config.DATA_DIR, '.wwebjs_auth') }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', qr => {
    console.log('\nEscanea este QR para vincular WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('🤖 Bot listo y conectado a WhatsApp');
  });

  client.on('message', async msg => {
    try {
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const from = contact.number || msg.from.replace(/@c\.us$/, '');
      const name = contact.pushname || contact.name || 'Cliente';
      const text = (msg.body || '').trim();
      const lower = text.toLowerCase();

      const s = getSession(from);

      // Comandos globales (no resetean el carrito, solo el estado de navegación)
      if (['hola','buenas','hello','hi','menu','menú','ayuda'].some(k => lower === k || lower.startsWith(k))) {
        // Responder SOLO con el enlace a la tienda para crear la orden
        const url = config.PUBLIC_ORDER_URL || 'http://localhost:3001/order';
        await msg.reply(`🛒 Haz tu pedido aquí:
${url}`);
        // No cambiar el estado ni mostrar más texto
        return;
      }
      if (lower === 'vaciar carrito' || lower === 'vaciar') {
        clearCart(from);
        await msg.reply('Carrito vaciado. Escribe "menu" para seguir agregando.');
        return;
      }
      if (lower.startsWith('quitar')) {
        // quitar [cant] [nombre]
        const rest = text.slice(6).trim();
        if (!rest) { await msg.reply('Formato: quitar [cantidad] [producto], por ejemplo: quitar 1 xtremes'); return; }
        const parts = rest.split(/\s+/);
        let q = parseInt(parts[0], 10);
        let nameStart = 0;
        if (Number.isInteger(q)) nameStart = 1; else { q = 1; }
        const nameToken = normalize(parts.slice(nameStart).join(' '));
        if (!nameToken) { await msg.reply('Indica el producto a quitar. Ej: quitar 1 panditas'); return; }
        // Busca el último ítem que coincida por nombre
        let idx = -1;
        for (let i = s.cart.length - 1; i >= 0; i--) {
          const it = s.cart[i];
          if (normalize(it.name).includes(nameToken) || nameToken.includes(normalize(it.name))) { idx = i; break; }
        }
        if (idx === -1) { await msg.reply('No encontré ese producto en tu carrito. Escribe "ver" para revisar.'); return; }
        const it = s.cart[idx];
        const removeQty = Math.min(q, it.quantity || 0);
        it.quantity -= removeQty;
        if (it.quantity <= 0) s.cart.splice(idx, 1);
        await msg.reply(`Quitado: ${removeQty} x ${it.name} (${it.presentation}${it.chamoy?`, ${it.chamoy}`:''}).\nCarrito: ${cartItemCount(s.cart)} producto(s) — Total $${cartTotal(s.cart).toFixed(2)}`);
        return;
      }
      if (lower === 'cancelar') {
        resetSession(from);
        await msg.reply('Pedido cancelado. Escribe "menu" para empezar de nuevo.');
        return;
      }
      if (lower === 'ver') {
        const total = cartTotal(s.cart);
        const lines = s.cart.length ? s.cart.map(it => `- ${it.quantity} x ${it.name} (${it.presentation} ${it.weight}${it.chamoy?`, ${it.chamoy}`:''}) $${(it.price*it.quantity).toFixed(2)}`) : ['(vacío)'];
        await msg.reply(`Carrito de ${name}:\n${lines.join('\n')}\nTotal: $${total.toFixed(2)}\n\nEscribe "finalizar" para confirmar, "menu" para agregar más, "quitar ..." o "vaciar carrito".`);
        return;
      }
      if (lower === 'finalizar') {
        if (!s.cart.length) { await msg.reply('Tu carrito está vacío. Escribe "menu" para agregar productos.'); return; }
        const total = cartTotal(s.cart);
        const lines = s.cart.length ? s.cart.map(it => `- ${it.quantity} x ${it.name} (${it.presentation} ${it.weight}${it.chamoy?`, ${it.chamoy}`:''}) $${(it.price*it.quantity).toFixed(2)}`) : ['(vacío)'];
        setSession(from, { state: 'confirming' });
        await msg.reply(`Confirma tu pedido:\n${lines.join('\n')}\nTotal: $${total.toFixed(2)}\n\nEscribe "confirmar" para crear la orden o "quitar ..." / "vaciar carrito" para ajustar.`);
        return;
      }
      if (lower === 'confirmar' && s.state === 'confirming') {
        if (!s.cart.length) { await msg.reply('Tu carrito está vacío. Escribe "menu" para agregar productos.'); return; }
        const order = {
          id: genOrderId(),
          status: 'new',
          createdAt: new Date().toISOString(),
          customer: { id: from, name, phone: from },
          items: s.cart.map(it => ({ name: it.name, quantity: it.quantity, price: it.price, presentation: it.presentation, weight: it.weight, type: it.type, chamoy: it.chamoy })),
          note: undefined,
          total: cartTotal(s.cart),
        };
        await ordersRepo.create(order);
        if (ioRef) ioRef.emit('orders:update', { type: 'created', order });
        resetSession(from);
        await msg.reply(`¡Gracias ${name}! Tu pedido fue recibido. ID: ${order.id}\nTotal: $${order.total.toFixed(2)}\nTe avisamos cuando esté listo.`);
        return;
      }

      // Pedido express: "enchiladas panditas 2" o "ahogadas xtremes 3 fresa,cereza,normal"
      if (await tryExpressOrder(msg, name, from)) {
        return;
      }

      // Flujo por estado
      if (s.state === 'choosingCategory') {
        const n = parseInt(lower, 10);
        if (!Number.isInteger(n) || n < 1 || n > menu.categories.length) {
          await msg.reply(formatMainMenu());
          return;
        }
        setSession(from, { state: 'choosingPresentation', catIdx: n - 1 });
        await msg.reply(formatPresentations(n - 1));
        return;
      }

      if (s.state === 'choosingPresentation') {
        const cat = menu.categories[s.catIdx];
        const n = parseInt(lower, 10);
        if (!Number.isInteger(n) || n < 1 || n > cat.presentations.length) {
          await msg.reply(formatPresentations(s.catIdx));
          return;
        }
        setSession(from, { state: 'choosingItem', presIdx: n - 1 });
        await msg.reply(formatItems(s.catIdx, n - 1));
        return;
      }

      if (s.state === 'choosingItem') {
        // parse "3" or "3x2"
        const m = lower.match(/^(\d+)(?:x(\d+))?$/);
        if (!m) { await msg.reply(formatItems(s.catIdx, s.presIdx)); return; }
        const idx = parseInt(m[1], 10) - 1;
        const qty = parseInt(m[2] || '1', 10);
        const pres = menu.categories[s.catIdx].presentations[s.presIdx];
        if (idx < 0 || idx >= pres.items.length) { await msg.reply(formatItems(s.catIdx, s.presIdx)); return; }
        // Si es ahogadas, pedimos chamoy
        if (pres.type === 'ahogadas') {
          if (qty > 1) {
            setSession(from, { state: 'choosingChamoyMulti', pendingMulti: { idx, qtyTotal: qty, qtyDone: 0, counts: {} } });
            await msg.reply(formatChamoy(1, qty));
            return;
          } else {
            setSession(from, { state: 'choosingChamoy', pendingItem: { idx, quantity: 1 } });
            await msg.reply(formatChamoy());
            return;
          }
        }
        const product = pres.items[idx];
        addToCart(from, { name: product.name, price: product.price, quantity: qty, presentation: pres.name, weight: pres.weight, type: pres.type });
        await msg.reply(`Agregado: ${qty} x ${product.name} (${pres.name} ${pres.weight}) $${(product.price*qty).toFixed(2)}\nCarrito: ${cartItemCount(s.cart)} producto(s) — Total $${cartTotal(s.cart).toFixed(2)}\n\nEscribe otro número para agregar más, "ver" para carrito o "finalizar".`);
        return;
      }

      if (s.state === 'choosingChamoy') {
        const n = parseInt(lower, 10);
        if (!Number.isInteger(n) || n < 1 || n > menu.chamoyOptions.length) { await msg.reply(formatChamoy()); return; }
        const chamoy = menu.chamoyOptions[n - 1];
        const pres = menu.categories[s.catIdx].presentations[s.presIdx];
        const product = pres.items[s.pendingItem.idx];
        const qty = s.pendingItem.quantity || 1;
        addToCart(from, { name: product.name, price: product.price, quantity: qty, presentation: pres.name, weight: pres.weight, type: pres.type, chamoy });
        setSession(from, { state: 'choosingItem', pendingItem: null });
        await msg.reply(`Agregado: ${qty} x ${product.name} (${pres.name} ${pres.weight}, ${chamoy}) $${(product.price*qty).toFixed(2)}\nCarrito: ${cartItemCount(s.cart)} producto(s) — Total $${cartTotal(s.cart).toFixed(2)}\n\nEscribe otro número para agregar más, "ver" para carrito o "finalizar".`);
        return;
      }

      if (s.state === 'choosingChamoyMulti') {
        const n = parseInt(lower, 10);
        const multi = s.pendingMulti;
        if (!Number.isInteger(n) || n < 1 || n > menu.chamoyOptions.length) { await msg.reply(formatChamoy(multi.qtyDone + 1, multi.qtyTotal)); return; }
        const chamoy = menu.chamoyOptions[n - 1];
        const pres = menu.categories[s.catIdx].presentations[s.presIdx];
        const product = pres.items[multi.idx];

        // Agrega una unidad con este chamoy
        addToCart(from, { name: product.name, price: product.price, quantity: 1, presentation: pres.name, weight: pres.weight, type: pres.type, chamoy });
        // Actualiza conteo
        const counts = { ...(multi.counts || {}) };
        counts[chamoy] = (counts[chamoy] || 0) + 1;
        const qtyDone = (multi.qtyDone || 0) + 1;
        const qtyTotal = multi.qtyTotal;

        if (qtyDone < qtyTotal) {
          setSession(from, { state: 'choosingChamoyMulti', pendingMulti: { ...multi, counts, qtyDone } });
          await msg.reply(formatChamoy(qtyDone + 1, qtyTotal));
          return;
        } else {
          // Finalizado el lote
          setSession(from, { state: 'choosingItem', pendingMulti: null });
          // Arma resumen por chamoy
          const parts = Object.entries(counts).map(([k, v]) => `${v} con ${k}`);
          const totalImporte = product.price * qtyTotal;
          await msg.reply(`Agregado: ${qtyTotal} x ${product.name} (${pres.name} ${pres.weight}) — ${parts.join(', ')} — $${totalImporte.toFixed(2)}\nCarrito: ${cartItemCount(s.cart)} producto(s) — Total $${cartTotal(s.cart).toFixed(2)}\n\nEscribe otro número para agregar más, "ver" para carrito o "finalizar".`);
          return;
        }
      }

      // Si no estamos en flujo, invitar a escribir menu
      await msg.reply(`No entendí. Escribe "menu" para empezar o "ayuda".`);
    } catch (err) {
      console.error('Error procesando mensaje:', err);
    }
  });

  client.initialize();
}
