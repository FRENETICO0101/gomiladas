import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import OrderPage from './order/OrderPage.jsx'
import './global.css'

function Root() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path.startsWith('/order')) return <OrderPage />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
