import { nanoid } from 'nanoid';

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 x+]/g, ' ') // deja numeros, letras y x
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAliasIndex(menu) {
  const index = new Map();
  for (const cat of menu.categories) {
    for (const item of cat.items) {
      const base = normalize(item.name);
      index.set(base, item.name);
      for (const a of item.aliases || []) index.set(normalize(a), item.name);
    }
  }
  return index;
}

export function parseOrderFromText(menu, text, customer) {
  const idx = buildAliasIndex(menu);
  const lines = text.split(/\n|,|;/).map(l => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    const nline = normalize(line);
    const m = nline.match(/(\d+)\s*(x|por|de)?\s*(.*)/);
    let qty = 1, namePart = nline;
    if (m) { qty = parseInt(m[1], 10) || 1; namePart = m[3] || m[0]; }

    // Encuentra el primer alias que aparezca en la línea
    let foundName = null;
    for (const key of idx.keys()) {
      if (!key) continue;
      if (namePart.includes(key)) { foundName = idx.get(key); break; }
    }

    if (foundName) items.push({ name: foundName, quantity: qty });
  }

  // Si no detectamos ítems, tratamos todo el texto como nota libre
  const note = items.length ? undefined : text.trim();

  return {
    id: nanoid(10),
    status: 'new',
    createdAt: new Date().toISOString(),
    customer: {
      id: customer?.id || customer?.phone || nanoid(8),
      name: customer?.name || 'Cliente',
      phone: customer?.phone || '',
    },
    items,
    note,
  };
}
