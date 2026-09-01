#!/bin/bash

# =============================================================
# Script de Instalação Automática - I.A MRO
# Para Ubuntu LTS (VPS Hostinger)
# Repositório: https://github.com/gabrielmaisresultadosonline/instaboost-mro.git
# Domínio: acessar.click
# =============================================================

set -e

echo "🚀 Iniciando instalação do I.A MRO..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis
APP_NAME="ia-mro"
APP_DIR="/var/www/$APP_NAME"
DOMAIN="acessar.click"
REPO_URL="https://github.com/gabrielmaisresultadosonline/instaboost-mro.git"

echo -e "${YELLOW}Atualizando sistema...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${YELLOW}Instalando dependências do sistema...${NC}"
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Instalar Node.js 20 LTS
echo -e "${YELLOW}Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar versões
echo -e "${GREEN}Node.js: $(node -v)${NC}"
echo -e "${GREEN}NPM: $(npm -v)${NC}"

# Criar diretório da aplicação
echo -e "${YELLOW}Criando diretório da aplicação...${NC}"
sudo mkdir -p /var/www
cd /var/www

# Clonar ou atualizar repositório
echo -e "${YELLOW}Clonando/Atualizando repositório...${NC}"
if [ -d "$APP_NAME" ]; then
    cd $APP_NAME
    git fetch origin
    git reset --hard origin/main
else
    git clone $REPO_URL $APP_NAME
    cd $APP_NAME
fi

sudo chown -R $USER:$USER $APP_DIR

# Instalar dependências e fazer build
echo -e "${YELLOW}Instalando dependências...${NC}"
npm install

echo -e "${YELLOW}Fazendo build da aplicação...${NC}"
npm run build

# Configurar Nginx
echo -e "${YELLOW}Configurando Nginx...${NC}"
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $APP_DIR/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - all routes go to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e reiniciar Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo -e "${GREEN}✅ Instalação concluída!${NC}"
echo ""
echo -e "${YELLOW}📌 Configurando SSL com Let's Encrypt...${NC}"
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
    echo -e "${YELLOW}⚠️  SSL não configurado automaticamente. Execute manualmente:${NC}"
    echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
}

echo ""
echo -e "${GREEN}✅ Tudo pronto!${NC}"
echo ""
echo "🌐 Acesse: https://$DOMAIN"
echo ""
echo "📝 Para atualizar futuramente, execute:"
echo "   cd $APP_DIR && ./deploy/update.sh"
echo ""
