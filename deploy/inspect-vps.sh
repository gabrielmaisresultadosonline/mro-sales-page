#!/bin/bash
# =============================================================
# I.A MRO — Inspetor de VPS (Ubuntu LTS 24)
# -------------------------------------------------------------
# Gera um relatório COMPLETO do que já existe na VPS:
#   - Schema do PostgreSQL (tabelas, colunas, PK/FK, índices)
#   - Contagem de linhas por tabela
#   - Serviços rodando (systemd, portas, docker)
#   - Configuração do Nginx (rotas /api, proxies)
#   - Rotas da API existente (se houver projeto Node)
#
# NÃO imprime senhas. NÃO altera nada. Somente leitura.
#
# USO:
#   scp deploy/inspect-vps.sh usuario@seu-vps:/tmp/
#   ssh usuario@seu-vps
#   chmod +x /tmp/inspect-vps.sh
#   /tmp/inspect-vps.sh
#   # depois: cat /tmp/mro-vps-report.txt   (copie e cole no chat)
# =============================================================

set -uo pipefail

OUT="/tmp/mro-vps-report.txt"
: > "$OUT"

log() { echo -e "$*" | tee -a "$OUT"; }
section() { log "\n\n===== $* ====="; }

# --- Config do banco (ajuste se necessário) -------------------
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
# Se precisar de senha, exporte antes: export PGPASSWORD='...'

log "RELATÓRIO DE INSPEÇÃO — I.A MRO"
log "Data: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
log "Host: $(hostname)  |  SO: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY | cut -d= -f2)"

# =============================================================
section "1. AMBIENTE"
# =============================================================
log "Node:   $(command -v node >/dev/null && node -v || echo 'não instalado')"
log "npm:    $(command -v npm  >/dev/null && npm -v  || echo 'não instalado')"
log "psql:   $(command -v psql >/dev/null && psql --version || echo 'não instalado')"
log "nginx:  $(command -v nginx >/dev/null && nginx -v 2>&1 || echo 'não instalado')"
log "docker: $(command -v docker >/dev/null && docker -v || echo 'não instalado')"
log "pm2:    $(command -v pm2 >/dev/null && pm2 -v || echo 'não instalado')"

# =============================================================
section "2. POSTGRES — BANCOS DISPONÍVEIS"
# =============================================================
if ! command -v psql >/dev/null; then
  log "psql não encontrado — pulando inspeção do banco."
else
  PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -X -A -F'|' --pset=footer=off"

  eval "$PSQL -d postgres -c \"SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1;\"" \
    >> "$OUT" 2>&1 || log "(falha ao listar bancos — confira PGUSER/PGPASSWORD)"

  # =============================================================
  section "3. POSTGRES — TABELAS DO BANCO '$PGDATABASE'"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -c \"
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2;\"" >> "$OUT" 2>&1

  # =============================================================
  section "4. POSTGRES — COLUNAS (schema completo)"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -c \"
    SELECT c.table_schema||'.'||c.table_name AS tabela,
           c.column_name, c.data_type, c.is_nullable, COALESCE(c.column_default,'') AS padrao
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE t.table_type='BASE TABLE'
      AND c.table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1, c.ordinal_position;\"" >> "$OUT" 2>&1

  # =============================================================
  section "5. POSTGRES — CHAVES (PK / FK / UNIQUE)"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -c \"
    SELECT tc.table_schema||'.'||tc.table_name AS tabela,
           tc.constraint_type, kcu.column_name,
           COALESCE(ccu.table_name,'') AS referencia
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2;\"" >> "$OUT" 2>&1

  # =============================================================
  section "6. POSTGRES — ÍNDICES"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -c \"
    SELECT schemaname||'.'||tablename AS tabela, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2;\"" >> "$OUT" 2>&1

  # =============================================================
  section "7. POSTGRES — CONTAGEM DE LINHAS POR TABELA"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -t -c \"
    SELECT table_schema||'.'||table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema NOT IN ('pg_catalog','information_schema');\"" 2>/dev/null \
  | while read -r tbl; do
      [ -z "$tbl" ] && continue
      n=$(eval "$PSQL -d $PGDATABASE -t -c \"SELECT count(*) FROM $tbl;\"" 2>/dev/null | tr -d ' ')
      log "$tbl = ${n:-erro} linhas"
    done

  # =============================================================
  section "8. POSTGRES — FUNÇÕES / VIEWS"
  # =============================================================
  eval "$PSQL -d $PGDATABASE -c \"
    SELECT routine_schema, routine_name, data_type
    FROM information_schema.routines
    WHERE routine_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2;\"" >> "$OUT" 2>&1

  eval "$PSQL -d $PGDATABASE -c \"
    SELECT table_schema, table_name FROM information_schema.views
    WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2;\"" >> "$OUT" 2>&1
fi

# =============================================================
section "9. SERVIÇOS E PORTAS ABERTAS"
# =============================================================
(ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null) >> "$OUT" 2>&1
log "\n--- systemd (ativos, não-padrão) ---"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null \
  | awk '{print $1}' >> "$OUT" 2>&1
log "\n--- docker ---"
docker ps --format '{{.Names}} | {{.Image}} | {{.Ports}}' 2>/dev/null >> "$OUT" 2>&1 || log "(sem docker)"
log "\n--- pm2 ---"
pm2 list --no-color 2>/dev/null >> "$OUT" 2>&1 || log "(sem pm2)"

# =============================================================
section "10. NGINX — SITES E ROTAS"
# =============================================================
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  log "\n----- $f -----"
  cat "$f" >> "$OUT" 2>&1
done

# =============================================================
section "11. APLICAÇÕES NODE ENCONTRADAS (/var/www, /opt, /srv, /root)"
# =============================================================
for base in /var/www /opt /srv /root /home; do
  [ -d "$base" ] || continue
  find "$base" -maxdepth 4 -name package.json -not -path '*/node_modules/*' 2>/dev/null | while read -r pkg; do
    dir=$(dirname "$pkg")
    log "\n----- APP: $dir -----"
    log "--- package.json (name/scripts/deps) ---"
    node -e "const p=require('$pkg');console.log(JSON.stringify({name:p.name,scripts:p.scripts,deps:Object.keys(p.dependencies||{})},null,2))" >> "$OUT" 2>&1 \
      || head -60 "$pkg" >> "$OUT" 2>&1

    log "--- variáveis do .env (NOMES apenas, valores ocultos) ---"
    [ -f "$dir/.env" ] && grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$dir/.env" >> "$OUT" 2>&1 || log "(sem .env)"

    log "--- rotas de API detectadas ---"
    grep -rhoE "(app|router|r)\.(get|post|put|patch|delete)\(\s*['\\\"\`][^'\\\"\`]+" \
      "$dir" --include='*.js' --include='*.ts' --include='*.mjs' \
      --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null \
      | sed -E "s/.*\.(get|post|put|patch|delete)\(\s*['\\\"\`]/\1 /" \
      | sort -u >> "$OUT" 2>&1 || log "(nenhuma rota Express/Fastify encontrada)"
  done
done

# =============================================================
section "12. FIM"
# =============================================================
log "Relatório salvo em: $OUT"
echo ""
echo "======================================================"
echo " ✅ Pronto. Rode agora:"
echo "     cat $OUT"
echo " e cole o conteúdo no chat do Lovable."
echo "======================================================"
