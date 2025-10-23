import { config } from './config.js';

// Menú con emojis y categoría de temporada (Halloween)
export const menu = {
  categories: [
    {
      name: '🍬 Gomiladas Clásicas',
      icon: '🍬',
      productIconsLine: '🐻 Panditas | 🍑 Aros de durazno | 🪱 Gusanos | 🐧 Pingüinos | 🦈 Tiburones | 🍭 Picagomas',
      presentations: [
        {
          name: 'Enchiladas',
          type: 'enchiladas',
          weight: '100 gr',
          items: [
            { name: 'panditas', icon: '🐻', price: 25 },
            { name: 'aros de durazno', icon: '🍑', price: 25 },
            { name: 'gusanos', icon: '🪱', price: 25 },
            { name: 'pinguinos', icon: '🐧', price: 25 },
            { name: 'tiburones', icon: '🦈', price: 25 },
            { name: 'picagomas', icon: '🍭', price: 25 },
          ],
        },
        {
          name: 'Ahogadas',
          type: 'ahogadas',
          weight: '150 gr',
          items: [
            { name: 'panditas', icon: '🐻', price: 35 },
            { name: 'aros de durazno', icon: '🍑', price: 35 },
            { name: 'gusanos', icon: '🪱', price: 35 },
            { name: 'pinguinos', icon: '🐧', price: 35 },
            { name: 'tiburones', icon: '🦈', price: 35 },
            { name: 'picagomas', icon: '🍭', price: 35 },
          ],
        },
      ],
    },
    {
      name: '🧸 Premium',
      icon: '🧸',
      productIconsLine: '🌈 Xtremes | ✨ Skittles | 🍬 Winnies | 🔥 Skwinkles rellenos',
      presentations: [
        {
          name: 'Enchiladas',
          type: 'enchiladas',
          weight: '100 gr',
          items: [
            { name: 'Xtremes', icon: '🌈', price: 35 },
            { name: 'Skittles', icon: '✨', price: 35 },
            { name: 'Winnies', icon: '🍬', price: 35 },
            { name: 'Skwinkles rellenos', icon: '🔥', price: 35 },
          ],
        },
        {
          name: 'Ahogadas',
          type: 'ahogadas',
          weight: '150 gr',
          items: [
            { name: 'Xtremes', icon: '🌈', price: 45 },
            { name: 'Skittles', icon: '✨', price: 45 },
            { name: 'Winnies', icon: '🍬', price: 45 },
            { name: 'Skwinkles rellenos', icon: '🔥', price: 45 },
          ],
        },
      ],
    },
    {
      name: '🎃 Especial Halloween',
      icon: '🎃',
      seasonal: true,
      productIconsLine: '👻 Panditas spooky | 🧛 Dientes | 🎃 Calabazas',
      presentations: [
        {
          name: 'Enchiladas', type: 'enchiladas', weight: '100 gr', items: [
            { name: 'Panditas spooky', icon: '👻', price: 30 },
            { name: 'Dientes', icon: '🧛', price: 30 },
            { name: 'Calabazas', icon: '🎃', price: 30 },
          ]
        },
        {
          name: 'Ahogadas', type: 'ahogadas', weight: '150 gr', items: [
            { name: 'Panditas spooky', icon: '👻', price: 40 },
            { name: 'Dientes', icon: '🧛', price: 40 },
            { name: 'Calabazas', icon: '🎃', price: 40 },
          ]
        },
      ],
    },
  ],
  chamoyOptions: ['normal', 'fresa', 'cereza'],
  chamoyAliases: {
    'clasico': 'normal', 'classico': 'normal', 'normal': 'normal', 'natural': 'normal', 'original': 'normal', 'tradicional': 'normal',
    'fresa': 'fresa',
    'cereza': 'cereza', 'cerezas': 'cereza'
  },
  helpText: `Pedido rápido:\n- Enchiladas: enchiladas [producto] [cantidad]   ej: enchiladas panditas 2\n- Ahogadas:  ahogadas [producto] [cantidad] [chamoy...]   ej: ahogadas xtremes 3 fresa,cereza,normal\n  • 1 chamoy = se aplica a todas. Si no indicas, te preguntamos.\n\nComandos: menu/hola • ver • finalizar • confirmar • quitar [cant] [producto] • vaciar carrito • cancelar`,
};

function categoryPriceLine(cat) {
  const ench = cat.presentations.find(p => p.type === 'enchiladas');
  const aho = cat.presentations.find(p => p.type === 'ahogadas');
  const enchPrice = ench?.items?.[0]?.price;
  const ahoPrice = aho?.items?.[0]?.price;
  if (enchPrice && ahoPrice) return `💵 $${enchPrice} (enchiladas) / $${ahoPrice} (ahogadas)`;
  return '';
}

export function formatMainMenu() {
  const lines = [
    '🛍️ Ordena desde tu celular o web:',
    `${config.PUBLIC_ORDER_URL}`,
    '',
    'O escríbelo aquí en WhatsApp:',
    '',
    '• enchiladas [producto] [cantidad]  ej: enchiladas panditas 2',
    '• ahogadas [producto] [cantidad] [chamoy]  ej: ahogadas xtremes 3 fresa,cereza,normal',
    '',
    'Presentaciones:',
    '',
    '• Enchiladas 100 gr',
    '• Ahogadas 150 gr (chamoy: normal, fresa, cereza)',
    '',
    'Productos:',
  ];
  const visibleCats = menu.categories.filter(c => !c.seasonal || config.HALLOWEEN_ENABLED);
  visibleCats.forEach((c) => {
    if (c.productIconsLine) lines.push(`${c.icon || ''} ${c.productIconsLine}`);
  });
  lines.push('');
  lines.push('Tip: también puedes responder con números para navegar.');
  lines.push('Comandos: menu • ver • finalizar • confirmar • quitar • vaciar carrito • cancelar');
  return lines.join('\n');
}

export function formatPresentations(catIdx) {
  const cat = menu.categories[catIdx];
  const lines = [`${cat.name} — Elige presentación:`];
  cat.presentations.forEach((p, i) => {
    const price = p.items?.[0]?.price ? ` $${p.items[0].price}` : '';
    lines.push(`${i + 1}) ${p.name} ${p.weight}${price}`);
  });
  lines.push('\nPuedes escribir tu pedido directo en cualquier momento.');
  return lines.join('\n');
}

export function formatItems(catIdx, presIdx) {
  const pres = menu.categories[catIdx].presentations[presIdx];
  const lines = [`${pres.name} ${pres.weight} — Elige producto:`];
  pres.items.forEach((it, i) => {
    const label = it.icon ? `${it.icon} ${it.name}` : it.name;
    lines.push(`${i + 1}) ${label} $${it.price}`);
  });
  const extra = pres.type === 'ahogadas'
    ? '\nTip: después eliges chamoy si no lo pusiste en el mensaje.'
    : '';
  lines.push(`\nResponde: 3  o  3x2.${extra}`);
  return lines.join('\n');
}

export function formatChamoy(step, total) {
  const title = (step && total)
    ? `Chamoy (${step}/${total}):`
    : 'Elige chamoy:';
  const lines = [title];
  const display = {
    normal: 'Clásico 🌶️',
    fresa: 'Fresa 🍓',
    cereza: 'Cereza 🍒',
  };
  menu.chamoyOptions.forEach((c, i) => lines.push(`${i + 1}) ${display[c] || c}`));
  lines.push('\nResponde con el número.');
  return lines.join('\n');
}
