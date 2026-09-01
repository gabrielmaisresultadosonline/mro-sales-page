#!/bin/bash

# =============================================================
# Script de Atualização - I.A MRO
# Para Ubuntu LTS (VPS Hostinger)
# =============================================================

set -e

echo "🔄 Atualizando I.A MRO..."

APP_DIR="/var/www/ia-mro"

cd $APP_DIR

echo "📥 Baixando atualizações do GitHub..."
git fetch origin
git reset --hard origin/main

echo "📦 Instalando dependências..."
npm install

echo "🔨 Fazendo build..."
npm run build

echo "🔄 Reiniciando Nginx..."
sudo systemctl restart nginx

echo ""
echo "✅ Atualização concluída!"
echo "🌐 Acesse: https://acessar.click"
echo ""
