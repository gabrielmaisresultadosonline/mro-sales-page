# Roadmap — I.A MRO

## Feito
- [x] Corrigir tela branca na home (`createClient` lançava `supabaseUrl is required` sem `.env`)
- [x] Script de inspeção da VPS (`deploy/inspect-vps.sh`) para mapear Postgres + API existentes
- [x] Corrigir erros de typecheck: `NodeJS.Timeout` em `src/pages/Ligacao.tsx`

## Em aberto
- [ ] Receber o relatório `mro-vps-report.txt` (schema Postgres + rotas da API da VPS)
- [ ] Criar camada `src/lib/db/` apontando para a API da VPS (`VITE_API_URL`)
- [ ] Migrar por domínio: auth → perfis/estratégias/criativos → admin → pagamentos/uploads
- [ ] Remover `@supabase/supabase-js`, `src/integrations/supabase/` e `supabase/functions/`
