import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
// Use same-origin API base so it works behind Nginx/HTTPS. In dev, Vite proxy or direct server handles routing.
const API_BASE = '';
const LOGO_SRC = import.meta.env.VITE_LOGO_URL || '/logo.png';

function Button({ children, onClick, selected }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 10, border: selected ? '2px solid #4cc9f0' : '1px solid #2a3647',
      background: selected ? '#132334' : '#0f1720', color: '#e6f2f8', width: '100%', textAlign: 'left'
    }}>{children}</button>
  );
}

function Qty({ value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={() => onChange(Math.max(1, value-1))} style={{ width:36, height:36 }}>-</button>
      <div style={{ minWidth:28, textAlign:'center' }}>{value}</div>
      <button onClick={() => onChange(value+1)} style={{ width:36, height:36 }}>+</button>
    </div>
  );
}

export default function OrderPage() {
  const [menu, setMenu] = useState(null);
  const [logoOk, setLogoOk] = useState(true);
  const [presentation, setPresentation] = useState('enchiladas'); // 'enchiladas' | 'ahogadas'
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [productIdx, setProductIdx] = useState(null);
  const [qty, setQty] = useState(1);
  const [chamoy, setChamoy] = useState('normal');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/menu`);
        setMenu(data);
      } catch (e) {
        console.error('Error cargando menú:', e);
        setMenu({ categories: [], chamoyOptions: [] });
      }
    })();
  }, []);

  const visibleProducts = useMemo(() => {
    if (!menu) return [];
    const cat = menu.categories[categoryIdx];
    if (!cat) return [];
    const pres = cat.presentations.find(p => p.type === presentation);
    return pres ? pres.items : [];
  }, [menu, categoryIdx, presentation]);

  const presLabel = presentation === 'enchiladas' ? 'Enchiladas 100 gr' : 'Ahogadas 150 gr';

  function addToCart() {
    if (productIdx == null) return;
    const cat = menu.categories[categoryIdx];
    const pres = cat.presentations.find(p => p.type === presentation);
    const prod = pres.items[productIdx];
    const item = {
      name: prod.name,
      presentation: pres.name,
      type: pres.type,
      weight: pres.weight,
      chamoy: presentation === 'ahogadas' ? chamoy : undefined,
      quantity: qty,
      price: prod.price,
    };
    setCart(prev => [...prev, item]);
    setProductIdx(null); setQty(1);
  }

  const total = cart.reduce((acc, it) => acc + it.price * (it.quantity || 1), 0);

  function removeFromCart(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  async function submitOrder() {
    if (!customer.name || !customer.phone || cart.length === 0) {
      alert('Completa tu nombre, teléfono y agrega al menos 1 producto.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer: { name: customer.name, phone: customer.phone },
        items: cart,
        note: undefined,
      };
  const { data } = await axios.post(`${API_BASE}/api/orders`, payload);
      alert(`Pedido recibido #${data.id}. ¡Gracias!`);
      // reset
      setCart([]);
      setCustomer({ name:'', phone:'' });
    } catch (e) {
      console.error(e);
      alert('No se pudo enviar el pedido. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!menu) return <div style={{ padding:16, color:'#e6f2f8' }}>Cargando menú...</div>;

  return (
    <div style={{ padding: 16, color:'#e6f2f8', background:'#0a1016', minHeight:'100vh' }}>
      <div style={{ maxWidth: 520, margin:'0 auto' }}>
        <div className="brand" style={{ display:'flex', alignItems:'center', margin:'8px 0 12px' }}>
          {logoOk ? (
            <img
              src={LOGO_SRC}
              alt="Logo"
              className="brand-logo"
              onError={() => setLogoOk(false)}
              style={{ height:36, width:'auto', marginRight:10, objectFit:'contain', display:'block' }}
            />
          ) : (
            <span className="brand-logo-fallback" aria-label="logo" style={{ marginRight:10, fontSize:24, lineHeight:1 }}>🍬</span>
          )}
          <h2 style={{ margin:0 }}>Haz tu pedido</h2>
        </div>
        <div style={{ background:'#0f1720', border:'1px solid #1b2330', borderRadius:12, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:13, color:'#9db2c0', marginBottom:8 }}>Presentación</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Button selected={presentation==='enchiladas'} onClick={() => setPresentation('enchiladas')}>Enchiladas · 100 gr</Button>
            <Button selected={presentation==='ahogadas'} onClick={() => setPresentation('ahogadas')}>Ahogadas · 150 gr</Button>
          </div>
          {presentation==='ahogadas' && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:13, color:'#9db2c0', marginBottom:6 }}>Chamoy</div>
              <div style={{ display:'flex', gap:8 }}>
                {(menu.chamoyOptions||[]).map(opt => (
                  <button key={opt} onClick={() => setChamoy(opt)} style={{
                    padding:'8px 10px', borderRadius:8, border: chamoy===opt ? '2px solid #4cc9f0':'1px solid #2a3647', background:'#0f1720', color:'#e6f2f8'
                  }}>{opt}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background:'#0f1720', border:'1px solid #1b2330', borderRadius:12, padding:12, marginBottom:12 }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {(menu.categories||[]).map((c, i) => (
              <button key={i} onClick={() => setCategoryIdx(i)} style={{ padding:'6px 10px', borderRadius:20, border: categoryIdx===i?'2px solid #4cc9f0':'1px solid #2a3647', background:'#0f1720', color:'#cfe3ee' }}>
                {c.icon || ''} {c.name.replace(/^[^ ]+\s+/, '')}
              </button>
            ))}
          </div>
          <div style={{ fontSize:13, color:'#9db2c0', marginBottom:8 }}>{presLabel}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8 }}>
            {visibleProducts.map((p, idx) => (
              <div key={idx} style={{ border:'1px solid #1b2432', borderRadius:10, padding:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{p.icon ? `${p.icon} ${p.name}` : p.name}</div>
                  <div style={{ color:'#9db2c0', fontSize:13 }}>${p.price}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {productIdx===idx ? (
                    <>
                      <Qty value={qty} onChange={setQty} />
                      <button onClick={addToCart}>Agregar</button>
                    </>
                  ) : (
                    <button onClick={() => { setProductIdx(idx); setQty(1); }}>Elegir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#0f1720', border:'1px solid #1b2330', borderRadius:12, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:13, color:'#9db2c0', marginBottom:8 }}>Tu carrito</div>
          {cart.length === 0 && <div style={{ color:'#9db2c0' }}>Vacío</div>}
          {cart.map((it, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px dashed #1b2330' }}>
              <div>
                {it.quantity} x {it.name} ({it.presentation}{it.weight?` ${it.weight}`:''}{it.chamoy?`, ${it.chamoy}`:''})
              </div>
              <div style={{ minWidth:70, textAlign:'right' }}>${(it.price * it.quantity).toFixed(2)}</div>
              <button onClick={() => removeFromCart(i)} aria-label={`Quitar ${it.name}`} title="Quitar" style={{ background:'#2a3647' }}>Quitar</button>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontWeight:700 }}>
            <div>Total</div>
            <div>${total.toFixed(2)}</div>
          </div>
          {cart.length>0 && (
            <div style={{ marginTop:8 }}>
              <button onClick={() => setCart([])} style={{ background:'#2a3647' }}>Vaciar</button>
            </div>
          )}
        </div>

        <div style={{ background:'#0f1720', border:'1px solid #1b2330', borderRadius:12, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:13, color:'#9db2c0', marginBottom:8 }}>Tus datos</div>
          <div style={{ display:'grid', gap:8 }}>
            <input placeholder="Nombre" value={customer.name} onChange={e=>setCustomer({ ...customer, name:e.target.value })} style={{ padding:10, borderRadius:8, border:'1px solid #2a3647', background:'#0b121a', color:'#e6f2f8' }} />
            <input placeholder="Teléfono (WhatsApp)" value={customer.phone} onChange={e=>setCustomer({ ...customer, phone:e.target.value })} style={{ padding:10, borderRadius:8, border:'1px solid #2a3647', background:'#0b121a', color:'#e6f2f8' }} />
          </div>
          <button disabled={submitting} onClick={submitOrder} style={{ marginTop:12, width:'100%', padding:12, borderRadius:10 }}>
            {submitting ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </div>

        <div style={{ color:'#8aa0ae', fontSize:12, textAlign:'center' }}>
          Tu pedido aparecerá en el panel de la tienda al instante.
        </div>
      </div>

      <style>{`
        *{ box-sizing: border-box; }
        body { margin:0; }
        button { background:#1b2330; color:#cfe3ee; border:1px solid #2a3647; border-radius:8px; padding:8px 12px; cursor:pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .brand-logo { height:36px; max-height:40px; width:auto; margin-right:10px; object-fit:contain; display:block; }
        .brand-logo-fallback { display:inline-block; margin-right:10px; font-size:24px; line-height:1; }
        @media (max-width: 600px) { .brand-logo { height:28px; max-height:32px; margin-right:8px; } }
      `}</style>
    </div>
  );
}
