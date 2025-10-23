// Sesiones en memoria para construir carrito paso a paso
// Estructura de session: { state, catIdx, presIdx, pendingItem: { idx, quantity }, cart: [ { name, price, quantity, presentation, weight, type, chamoy? } ] }

const sessions = new Map(); // key: phone

export function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { state: 'idle', cart: [] });
  }
  return sessions.get(phone);
}

export function resetSession(phone) {
  sessions.set(phone, { state: 'idle', cart: [] });
}

export function setSession(phone, data) {
  sessions.set(phone, { ...(sessions.get(phone) || {}), ...data });
}

export function addToCart(phone, item) {
  const s = getSession(phone);
  // merge same product + presentation + chamoy
  const key = (i) => `${i.name}|${i.presentation}|${i.type}|${i.chamoy||''}|${i.price}`;
  const existing = s.cart.find(x => key(x) === key(item));
  if (existing) existing.quantity += item.quantity || 1;
  else s.cart.push({ ...item });
}

export function cartTotal(cart) {
  return (cart || []).reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
}

export function clearCart(phone) {
  const s = getSession(phone);
  s.cart = [];
}

export function cartItemCount(cart) {
  return (cart || []).reduce((n, it) => n + (it.quantity || 0), 0);
}
