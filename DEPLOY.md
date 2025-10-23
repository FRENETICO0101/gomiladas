# Despliegue siempre activo (sin depender de tu PC)

Esta guía te da dos caminos para que la solución esté siempre encendida y accesible desde Internet:

- Opción A (recomendada): VPS (servidor virtual) con Node + PM2 + Nginx y tu dominio
- Opción B: Contenedor Docker (Fly.io/DigitalOcean/Hetzner) con volumen persistente

Además, el bot de WhatsApp queda logueado de forma persistente porque guardamos la sesión en `server/data/.wwebjs_auth`.

Importante: Tu línea de WhatsApp Business debe tener datos; el bot usa WhatsApp Web (no Cloud API) y requiere escanear un QR la primera vez.

---

## Opción A: VPS con PM2 y Nginx

1) Crear un VPS (Ubuntu 22.04 recomendado) en tu proveedor preferido (Hetzner, DigitalOcean, etc.).

2) Instalar dependencias básicas

```bash
sudo apt update && sudo apt install -y curl git ufw
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs build-essential
sudo npm i -g pm2
```

3) Clonar el proyecto y preparar build

```bash
git clone https://tu-repo.git asistente_gomitas
cd asistente_gomitas
npm --prefix web ci || (cd web && npm i)
npm --prefix web run build
npm --prefix server ci || (cd server && npm i)
```

4) Variables de entorno (ajusta dominio)

Edita `ecosystem.config.js` (ya incluido) y cambia `PUBLIC_BASE_URL` a tu subdominio, por ejemplo `https://pedido.gomiladas.com`.

Opcionalmente crea `server/.env` con:

```
NODE_ENV=production
PORT=3001
PUBLIC_BASE_URL=https://pedido.gomiladas.com
```

5) Arrancar con PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # sigue las instrucciones para habilitar arranque automático
```

6) Nginx como reverse proxy + SSL (Let’s Encrypt)

```bash
sudo apt install -y nginx
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Archivo básico en `/etc/nginx/sites-available/gomitas`:

```
server {
  server_name pedido.gomiladas.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Activar sitio y TLS:

```bash
sudo ln -s /etc/nginx/sites-available/gomitas /etc/nginx/sites-enabled/gomitas
sudo nginx -t && sudo systemctl reload nginx
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d pedido.gomiladas.com
```

7) Vincular WhatsApp (una sola vez)

- Ver logs para ver el QR:

```bash
pm2 logs gomitas
```

- Escanea el QR desde la app de WhatsApp Business > Dispositivos vinculados.
- La sesión se guardará en `server/data/.wwebjs_auth` y seguirá activa tras reinicios.

8) Verificación

- Abre `https://pedido.gomiladas.com/order` desde datos móviles.
- Escribe “hola” al WhatsApp: debe responder solo con el enlace del pedido.

---

## Opción B: Docker (con volumen persistente)

El repo incluye `Dockerfile` y `.dockerignore`.

1) Build de imagen y ejecución local (en el servidor):

```bash
docker build -t gomitas:prod .
# monta un volumen para persistir la data (órdenes y sesión de WhatsApp)
docker run -d --name gomitas \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PUBLIC_BASE_URL=https://pedido.gomiladas.com \
  -v /opt/gomitas-data:/app/server/data \
  gomitas:prod
```

2) Reverse proxy + HTTPS

Usa Nginx o Traefik para exponer `https://pedido.gomiladas.com` hacia `http://127.0.0.1:3001` como en la Opción A.

3) Plataformas soportadas

- Fly.io: crea un volumen `fly volumes create data` y mapea a `/app/server/data` en tu `fly.toml`.
- DigitalOcean Apps/Containers o Hetzner Cloud: configura el puerto 3001 y mapea el volumen.

4) Escaneo de QR

- Mira los logs del contenedor para obtener el QR ASCII:

```bash
docker logs -f gomitas
```

---

## Notas importantes

- Dominio y DNS: Crea un registro A/AAAA o usa un proxy (Cloudflare) apuntando a tu servidor; el tutorial de Nginx + Certbot maneja el SSL.
- `PUBLIC_BASE_URL`: debe apuntar a tu dominio público para que el bot comparta el enlace correcto en WhatsApp.
- Persistencia: Monta `/app/server/data` para no perder pedidos ni la sesión de WhatsApp.
- Recursos mínimos: 1 vCPU, 512 MB RAM funcionan; 1 GB recomendado. Asegura suficiente espacio para logs y data.
- Backups: Respaldar `/app/server/data/*.json` periódicamente.
- Alternativa sin QR: migrar a WhatsApp Cloud API (requiere algunos cambios de código y una app de Meta) si deseas evitar Puppeteer.
