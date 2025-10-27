import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// Producción: usar mismo origen para API y WS detrás de Nginx/Cloudflare. En dev, Vite proxy.
const API_BASE = '';
const LOGO_SRC = import.meta.env.VITE_LOGO_URL || '/logo.png';

function Section({ title, children }) {
  return (
    <div style={{ flex:1, minWidth:280, background:'#0f1720', border:'1px solid #1b2330', borderRadius:10, padding:12 }}>
      <div style={{ fontSize:14, color:'#92a4b2', marginBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}

function OrderCard({ order, onChangeStatus, onDelete }) {
  // Agrupar productos para preparación: Ahogadas primero (por chamoy), luego Enchiladas
  const grouped = React.useMemo(() => {
    const items = Array.isArray(order.items) ? order.items : [];
    const groups = new Map();
    for (const it of items) {
      const type = it.type || (it.presentation?.toLowerCase().includes('ahog') ? 'ahogadas' : 'enchiladas');
      const cham = type === 'ahogadas' ? (it.chamoy || 'normal') : '';
      const key = `${type}|${cham}|${it.name}`;
      const prev = groups.get(key) || { ...it, quantity: 0 };
      prev.quantity += (it.quantity || 1);
      groups.set(key, prev);
    }
    // Orden sugerido: ahogadas (normal, fresa, cereza) por nombre; luego enchiladas por nombre
    const chamOrder = { normal: 0, fresa: 1, cereza: 2 };
    const arr = Array.from(groups.values());
    arr.sort((a, b) => {
      const ta = (a.type || '').toLowerCase();
      const tb = (b.type || '').toLowerCase();
      if (ta !== tb) return ta === 'ahogadas' ? -1 : 1;
      if (ta === 'ahogadas') {
        const ca = chamOrder[(a.chamoy || 'normal').toLowerCase()] ?? 99;
        const cb = chamOrder[(b.chamoy || 'normal').toLowerCase()] ?? 99;
        if (ca !== cb) return ca - cb;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    return arr;
  }, [order.items]);

  return (
    <div style={{ background:'#0b1118', border:'1px solid #192230', borderRadius:8, padding:10, marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <b>#{order.id}</b> · {order.customer?.name || 'Cliente'} · {order.customer?.phone}
        </div>
        <small style={{ color:'#6b7c8a' }}>{new Date(order.createdAt).toLocaleTimeString()}</small>
      </div>
      <div style={{ marginTop:8 }}>
        <div style={{ fontSize:12, color:'#7f92a0', marginBottom:4 }}>Preparación</div>
        <ul style={{ margin:'0 0 6px 18px' }}>
          {grouped.map((it, idx) => (
            <li key={idx}>
              {it.quantity || 1} x {it.name} {it.type==='ahogadas' ? `(Ahogadas${it.weight?` ${it.weight}`:''}${it.chamoy?`, ${it.chamoy}`:''})` : `(Enchiladas${it.weight?` ${it.weight}`:''})`}
              {typeof it.price === 'number' ? ` — $${(it.price * (it.quantity||1)).toFixed(2)}` : ''}
            </li>
          ))}
        </ul>
      </div>
      {typeof order.total === 'number' && <div style={{ fontWeight:600 }}>Total: ${order.total.toFixed(2)}</div>}
      {order.note && <div style={{ fontSize:12, color:'#9fb2bf' }}>Nota: {order.note}</div>}
      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
									
			
        {order.status !== 'new' && <button onClick={() => onChangeStatus(order.id, 'new')}>Nuevo</button>}
        {order.status !== 'preparing' && <button onClick={() => onChangeStatus(order.id, 'preparing')}>Preparando</button>}
        {order.status !== 'done' && <button onClick={() => onChangeStatus(order.id, 'done')}>Listo</button>}
        {order.status === 'done' && (
          <>
            <button onClick={() => order._onResend?.(order.id)} title="Reenviar notificación por WhatsApp">Reenviar aviso</button>
            <button onClick={() => onDelete(order.id)} style={{ background:'#3a1f1f', borderColor:'#5a2a2a' }}>Eliminar</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await axios.get(`${API_BASE}/api/orders`);
      setOrders(data);
    })();

  const s = io(undefined, { transports: ['websocket'] });
    s.on('orders:update', evt => {
      setOrders(prev => {
        if (evt.type === 'created') {
          const exists = prev.some(o => o.id === evt.order.id);
          return exists ? prev : [evt.order, ...prev];
        }
        if (evt.type === 'updated') {
          return prev.map(o => o.id === evt.order.id ? evt.order : o);
        }
        return prev;
      });
    });
    return () => s.close();
  }, []);

  const grouped = useMemo(() => ({
    new: orders.filter(o => o.status === 'new'),
    preparing: orders.filter(o => o.status === 'preparing'),
    done: orders.filter(o => o.status === 'done'),
  }), [orders]);

  async function onChangeStatus(id, status) {
    await axios.post(`${API_BASE}/api/orders/${id}/status`, { status });
    // actual state will update via socket
  }

  async function onDelete(id) {
    if (!confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return;
    await axios.delete(`${API_BASE}/api/orders/${id}`);
    setOrders(prev => prev.filter(o => o.id !== id));
  }

  async function onResend(id) {
    try {
      await axios.post(`${API_BASE}/api/orders/${id}/notify`);
      alert('Notificación reenviada.');
    } catch (e) {
      console.error(e);
      alert('No se pudo reenviar la notificación.');
    }
  }

  async function sendPromoNow() {
    const text = prompt('Texto de promoción a enviar a todos los clientes:');
    if (!text) return;
    await axios.post(`${API_BASE}/api/promotions/send-now`, { text });
    alert('Promoción enviada.');
  }

  return (
    <div>
      <header>
        <div className="brand">
          {logoOk ? (
            <img
              src={LOGO_SRC}
              alt="Logo"
              onError={() => setLogoOk(false)}
              style={{ height: 24, width: 'auto', marginRight: 8, verticalAlign: 'middle' }}
            />
          ) : (
            <span style={{ marginRight: 8 }}>🍬</span>
          )}
          <span>Panel de Órdenes — Gomitas</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={sendPromoNow}>Enviar promoción</button>
        </div>
      </header>
      <div style={{ padding:16 }}>
        <div className="orders-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          <Section title={`Nuevas (${grouped.new.length})`}>
            {grouped.new.map(o => <OrderCard key={o.id} order={{...o, _onResend: onResend}} onChangeStatus={onChangeStatus} onDelete={onDelete} />)}
          </Section>
          <Section title={`Preparando (${grouped.preparing.length})`}>
            {grouped.preparing.map(o => <OrderCard key={o.id} order={{...o, _onResend: onResend}} onChangeStatus={onChangeStatus} onDelete={onDelete} />)}
          </Section>
          <Section title={`Listas (${grouped.done.length})`}>
            {grouped.done.map(o => <OrderCard key={o.id} order={{...o, _onResend: onResend}} onChangeStatus={onChangeStatus} onDelete={onDelete} />)}
          </Section>
        </div>
      </div>
      <style>{`
        button { background:#1b2330; color:#cfe3ee; border:1px solid #2a3647; border-radius:6px; padding:6px 10px; cursor:pointer; }
        button:hover { background:#223043; }
        header { display:flex; align-items:center; justify-content:space-between; padding: 10px 16px; }
        .brand { display:flex; align-items:center; font-weight:600; }
        @media (max-width: 1024px) {
          .orders-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
