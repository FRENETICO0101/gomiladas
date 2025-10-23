#!/usr/bin/env bash
set -euo pipefail

# Hostinger/Ubuntu 22.04 bootstrap for gomitas app (API+Web+WhatsApp bot)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/your-repo/main/scripts/hostinger-bootstrap.sh | bash -s -- pedido.gomiladas.com
# Or copy this file to the server and run: sudo bash scripts/hostinger-bootstrap.sh pedido.gomiladas.com

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain> (e.g., pedido.gomiladas.com)"
  exit 1
fi

echo "[1/7] Updating packages and installing dependencies..."
apt update && apt upgrade -y
apt install -y curl git ufw nginx ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
  libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

echo "[2/7] Installing Node.js 18 LTS and PM2..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs build-essential
npm i -g pm2

echo "[3/7] Configuring firewall..."
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
yes | ufw enable || true

APP_DIR="/opt/asistente_gomitas"
echo "[4/7] Preparing app directory at $APP_DIR ..."
mkdir -p "$APP_DIR" && chown "$SUDO_USER:${SUDO_USER:-root}" "$APP_DIR" || true

echo "[!] Upload or clone your project into $APP_DIR, then run this script again starting from step 5."
echo "    For Git: cd $APP_DIR && git clone <YOUR_REPO_URL> ."
echo "    For SFTP: upload your local project folder contents into $APP_DIR"

if [[ ! -f "$APP_DIR/server/package.json" ]]; then
  echo "Project not found at $APP_DIR. Skipping build and PM2 start."
  echo "After uploading/cloning, run the following commands manually:"
  cat <<MANUAL
cd $APP_DIR
npm --prefix web ci || (cd web && npm i)
npm --prefix web run build
npm --prefix server ci || (cd server && npm i)
mkdir -p server/data
PUBLIC_BASE_URL=https://$DOMAIN pm2 start ecosystem.config.js
pm2 save
pm2 startup
MANUAL
  exit 0
fi

cd "$APP_DIR"

echo "[5/7] Installing dependencies and building web..."
npm --prefix web ci || (cd web && npm i)
npm --prefix web run build
npm --prefix server ci || (cd server && npm i)
mkdir -p server/data

echo "[6/7] Starting app with PM2..."
export PUBLIC_BASE_URL="https://$DOMAIN"
pm2 start ecosystem.config.js --update-env
pm2 save
pm2 startup | sed -n '1,200p'

echo "[7/7] Configuring Nginx and SSL for $DOMAIN ..."
cat >/etc/nginx/sites-available/gomitas <<NGINX
server {
  server_name $DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX

ln -sf /etc/nginx/sites-available/gomitas /etc/nginx/sites-enabled/gomitas
nginx -t && systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  snap install core; snap refresh core
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
fi

certbot --nginx -d "$DOMAIN" || true

echo "\nDone. Next steps:"
echo "- pm2 logs gomitas   # Scan the WhatsApp QR (one-time)"
echo "- Open https://$DOMAIN/order from mobile data"
echo "- Set DNS A record for $DOMAIN to this server IP if not already"