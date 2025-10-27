# Gomiladas – Pedido por WhatsApp (Self‑hosted)

Sistema completo y auto‑hospedado para tomar pedidos por WhatsApp, con panel en tiempo real, promociones automáticas y flujo de cliente por link público.

- Cliente pide por link: `https://<tu-dominio>/order`
- Panel del negocio: `https://<tu-dominio>/` (protegido con Basic Auth en Nginx)
- Bot de WhatsApp: responde “hola/menu/ayuda” con el link y notifica al cliente cuando su pedido está listo.

## Arquitectura

- Backend: Node.js + Express + Socket.IO + whatsapp-web.js (sesión persistente con LocalAuth)
- Frontend: React + Vite (SPA servida por Express en producción)
- Reverse proxy: Nginx + Let’s Encrypt (vía Certbot), detrás de Cloudflare (Full strict)
- Persistencia: Archivos JSON en `server/data/`
  - `orders.json` – pedidos
  - `customers.json` – clientes
  - `.wwebjs_auth/` – sesión del bot de WhatsApp

## Flujo clave: Listo → WhatsApp → coordinación por chat

- Cuando el negocio cambia el estado del pedido a “Listo” (status `done`):
  - La API envía automáticamente un WhatsApp al cliente:
    - Texto: `Hola <nombre>, tu pedido #<id> está listo — Total: $<monto>.\nResponde este mensaje para coordinar la entrega. ¡Gracias por tu compra!`
  - En el panel existe un botón “Reenviar aviso” por si necesitas reenviarlo manualmente.
- La coordinación se realiza directamente en ese chat de WhatsApp entre el cliente y el número del negocio.

## Variables de entorno claves

- `PUBLIC_BASE_URL` – URL pública base (ej. `https://pedido.gomiladas.com`)
- `PUBLIC_ORDER_URL` – URL directa para el cliente (opcional; por defecto `<PUBLIC_BASE_URL>/order`)
- `WHATSAPP_COUNTRY_CODE` – Código de país para normalizar teléfonos (por defecto `52` para MX)
- `DATA_DIR` – Carpeta de datos (por defecto `server/data`)
- `HALLOWEEN_ENABLED` – Muestra/oculta categorías estacionales (true/false)

## Despliegue (resumen)

1) VPS (Ubuntu) con Node 18+, Nginx y PM2. Construye el front y levanta el server en `:3001`.
2) Nginx: proxy `443 → 127.0.0.1:3001` con cabeceras de WebSocket.
3) Certificado SSL con Certbot. Cloudflare en modo proxy “Full (strict)”.
4) Inicia con PM2 (ejemplo):

```bash
# desde el directorio del proyecto en el VPS
export PUBLIC_BASE_URL="https://tu-dominio" \
       WHATSAPP_COUNTRY_CODE=52
pm2 start server/src/index.js --name gomitas --update-env
pm2 save
```

Notas:
- La primera vez, abre el panel y escanea el QR de WhatsApp (sesión queda en `server/data/.wwebjs_auth`).
- En producción, Express sirve el build de Vite desde `web/dist`.

## Seguridad del panel

- Nginx protege `GET /` y rutas admin con Basic Auth.
- Público: `/order`, `/assets`, `/favicon.ico`, `GET /api/menu`, `POST /api/orders`.

## Endpoints principales

- Público
  - `GET /api/menu`
  - `POST /api/orders` – crea pedido (normaliza teléfono a JID válido de WhatsApp)
- Panel/Admin
  - `GET /api/orders` – lista pedidos
  - `POST /api/orders/:id/status` – cambia estado (al pasar a `done` envía WhatsApp)
  - `POST /api/orders/:id/notify` – reenvía manualmente el aviso “Listo”
  - `DELETE /api/orders/:id` – elimina pedidos en estado `done`

## Scripts de mantenimiento

Ubicación: `scripts/`

- Backup de datos (y depuración de backups >14 días)

```bash
bash scripts/backup.sh
```

- Purgar pedidos antiguos (status `done`) – por defecto 30 días

```bash
node scripts/purge-orders.js --days 30
# simulación sin escribir cambios
node scripts/purge-orders.js --days 60 --dry-run
```

- Exportar pedidos a CSV

```bash
# a stdout
node scripts/export-csv.js > orders.csv
# a archivo con ruta
node scripts/export-csv.js --out exports/orders-$(date +%Y%m%d).csv
```

Sugerencia: agenda estas tareas con `cron` (ej. backup diario y purga semanal).

## Operación diaria

- Panel en `https://<tu-dominio>/` (credenciales Basic Auth en Nginx)
- Vista de cliente en `https://<tu-dominio>/order`
- Cambia estado a “Listo” para disparar la notificación por WhatsApp.
- Usa “Reenviar aviso” si el cliente no recibió o perdió el mensaje.

### Logo del panel

- Para mostrar tu propio logo en el encabezado:
  - Opción 1 (simple): coloca `web/public/logo.png` y recompila el front.
  - Opción 2: define `VITE_LOGO_URL` al construir el front, apuntando a la URL de tu logo.
- Si la imagen no carga, se mostrará el ícono de 🍬 como respaldo.

## Solución de problemas

- El bot no envía mensajes: verifica en PM2 logs que el cliente de WhatsApp esté “ready” y vuelve a escanear el QR si es necesario.
- El cliente ve “Cargando menú…”: asegúrate de que el front consuma `/api/*` en el mismo origen (sin `:3001`), y limpia cachés si cambiaste el build.
- HTTPS/Cloudflare: si ves 521/522, valida DNS, que Nginx escuche 443, y renueva el certificado.

## Estructura de datos

- `server/data/orders.json`: array de objetos `{ id, status, createdAt, customer{ name, phone }, items[], total }`
- `server/data/customers.json`: clientes; el teléfono se normaliza a formato válido para WhatsApp (MX produce `521XXXXXXXXXX`).

## Licencia

Uso interno del negocio. Ajusta y despliega bajo tu propio VPS.
