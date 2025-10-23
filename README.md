# Asistente de Órdenes de Gomitas

Solución rápida y funcional para capturar pedidos desde WhatsApp Business, gestionarlos en un panel visual en tiempo real y enviar promociones automatizadas. Toda la solución es gratuita y auto-contenida.

## Arquitectura

- Cliente: WhatsApp Business (número vinculado)
- Bot: whatsapp-web.js (Node.js)
- API: Express + Socket.IO
- Base de datos ligera: Archivos JSON (sin dependencias nativas)
- Panel web: React + Vite
- Automatización: node-cron (y webhooks para n8n opcional)

Ruta de datos:
WhatsApp → Bot → API/DB → Socket.IO → Panel Web → (n8n opcional) → Promos

## Requisitos previos
- Node.js 18+ instalado
- WhatsApp Business en tu teléfono para enlazar sesión por QR

## Puesta en marcha

1) Instalar dependencias

- Servidor
```cmd
cd server
npm install
```

- Panel web
```cmd
cd ..\web
npm install
```

2) Arrancar los servicios (en dos terminales)

- Servidor (muestra QR en consola la primera vez)
```cmd
cd server
npm run dev
```

- Panel web
```cmd
cd web
npm run dev
```

3) Vincular WhatsApp
- En la consola del servidor se mostrará un QR ASCII. En WhatsApp: Configuración → Dispositivos vinculados → Vincular un dispositivo.
- Tras vincular, los mensajes entrantes se procesarán automáticamente.

4) Abrir el panel
- Vite indicará la URL (por defecto http://localhost:5173). Verás las órdenes nuevas en tiempo real.

## Personalización del Menú y Flujo
- Edita `server/src/menu.js` para definir categorías, productos y alias de palabras clave.
- El bot responde a mensajes con palabras del menú y crea órdenes simples automáticamente.
- Puedes afinar el parser en `server/src/parsers.js`.

### Cómo hacer el pedido express (una sola línea)
Haz tu pedido escribiendo una frase. El bot detecta la presentación (enchiladas/ahogadas), el producto, la cantidad y, si aplica, los sabores de chamoy.

- Enchiladas (sin chamoy):
  - Formato: `enchiladas [producto] [cantidad]`
  - Ejemplos: `enchiladas panditas 2`, `enchiladas aros de durazno 3`

- Ahogadas (con chamoy):
  - Formato: `ahogadas [producto] [cantidad] [chamoy1,chamoy2,...]`
  - Ejemplos: `ahogadas xtremes 3 fresa,cereza,normal`, `ahogadas skittles 2 fresa`
  - Consejos:
    - Si envías 1 chamoy y pides varias piezas, se aplica a todas (ej. `ahogadas xtremes 3 fresa`).
    - Si no indicas chamoy, el bot te lo pedirá por pieza: “(1 de N) … (N de N)”.
    - Los chamoys se separan por comas (puedes escribir sin acentos).

Comandos útiles del chat:
- `menu` / `hola` (ver opciones, no vacía el carrito)
- `ver` (mostrar carrito)
- `finalizar` (pre-confirmación)
- `confirmar` (crear la orden)
- `quitar 1 xtremes` (remueve cantidad del último ítem que coincide)
- `vaciar carrito` (limpia el carrito)
- `cancelar` (descarta todo)

## Endpoints principales
- GET `http://localhost:3001/api/orders`
- POST `http://localhost:3001/api/orders/:id/status` body: `{"status":"preparing|done"}`
- POST `http://localhost:3001/api/promotions/send-now` body: `{"text":"Promoción..."}`
- Webhooks (n8n):
  - POST `http://localhost:3001/webhook/order` → crea orden vía JSON
  - POST `http://localhost:3001/webhook/promo` → dispara promoción inmediata

## Integración con n8n (opcional)
- Ejecuta n8n local (Docker o binario). Crea un flujo con un nodo Webhook apuntando a `/webhook/order` y/o `/webhook/promo`.
- Ejemplo de payload para orden:
```json
{
  "customer": {"name":"Ana","phone":"5215555555555"},
  "items": [{"name":"Gomita Ácida","quantity":2}],
  "note": "Sin chile"
}
```

## Programación de promociones
- Configura `PROMO_CRON` en `.env` o usa el endpoint `send-now`.
- Por defecto hay un ejemplo semanal los lunes a las 12:00.

## Temporadas (Halloween)
- Para mostrar/ocultar el apartado "🎃 Especial Halloween" en el menú, usa la variable de entorno:

```cmd
set HALLOWEEN_ENABLED=false
```

Vuelve a iniciar el servidor para aplicar el cambio.

## Ver el panel en móvil o tablet (misma red Wi‑Fi)
1) Arranca backend y panel en tu PC
  - Servidor API/WhatsApp: puerto 3001
  - Panel (Vite): puerto 5173
2) Asegúrate de que el panel escuchará en la red local (ya configurado en `web/vite.config.js` con `host: true`).
3) Obtén la IP de tu PC (Windows):
  - Abre cmd y ejecuta: `ipconfig`
  - Copia tu “Dirección IPv4” (ej. 192.168.1.50)
4) En el móvil/tablet conectado a la misma Wi‑Fi, abre:
  - Panel: `http://<IPv4>:5173` (ej. http://192.168.1.50:5173)
  - El panel ya hablará con el backend en `http://<IPv4>:3001` automáticamente.
5) Si no abre:
  - Desactiva VPNs.
  - Permite a Node.js a través del Firewall de Windows cuando te lo pida.
  - Verifica que los puertos 5173 y 3001 no estén bloqueados.

## Archivos de datos
- `server/data/orders.json`
- `server/data/customers.json`
- `server/data/settings.json`

## Notas de seguridad
- Esta solución es local y pensada para operación en un equipo del negocio.
- No expongas el puerto del servidor en internet sin medidas adicionales.

## Próximos pasos sugeridos
- Arrastrar/soltar de columnas en el panel.
- Autenticación básica para el panel.
- Reportes y métricas.
