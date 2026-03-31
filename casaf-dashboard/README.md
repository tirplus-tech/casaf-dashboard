# CASAF

Plataforma operacional para gestao de obras com foco em:
- leitura executiva do portfolio
- operacao diaria de campo
- planejamento e liberacoes
- fechamento financeiro
- IA especialista contextualizada pela obra

## Stack atual
- React 18
- Create React App
- Node.js server para servir build e proxy da IA
- Supabase para auth, persistencia e storage

## Ambientes recomendados
- `local`: desenvolvimento e validacao rapida
- `staging`: homologacao com dados e auth reais
- `production`: ambiente oficial do cliente

## Variaveis de ambiente
Use o arquivo [.env.example](/Users/douguap/Documents/New%20project/casaf-dashboard/.env.example) como referencia.

Obrigatorias para publicacao oficial:
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_APP_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Opcional:
- `ASSISTANT_RATE_LIMIT_WINDOW_MS`
- `ASSISTANT_RATE_LIMIT_MAX`

## Como rodar localmente
1. Instale dependencias:
```bash
npm install
```
2. Crie `.env.local` com as variaveis necessarias.
3. Rode o sistema:
```bash
npm start
```
4. Abra:
```text
http://localhost:4173
```

## Build de producao
```bash
npm run build
```

## Testes
```bash
npm test -- --watch=false
```

## Servidor HTTP
O arquivo [server.js](/Users/douguap/Documents/New%20project/casaf-dashboard/server.js) faz:
- entrega da build estaticamente
- proxy da IA em `/api/assistant/obra` e `/api/assistant/portfolio`
- validacao de sessao Supabase para usar a IA
- rate limiting basico por IP
- healthcheck em `/healthz` e `/readyz`
- headers de seguranca

## Supabase
Os schemas base estao em:
- [schema.sql](/Users/douguap/Documents/New%20project/casaf-dashboard/supabase/schema.sql)
- [operational_schema.sql](/Users/douguap/Documents/New%20project/casaf-dashboard/supabase/operational_schema.sql)

Antes de publicar oficialmente:
1. configurar `Site URL` e `Redirect URLs` do projeto Supabase
2. revisar e aplicar RLS nas tabelas
3. transformar `obra-midias` em bucket privado
4. usar URLs assinadas para fotos
5. separar dados demo de dados reais

## Checklist de publicacao
### Infra
- dominio oficial definido
- frontend publicado em host estavel
- backend publicado com HTTPS
- variaveis de ambiente configuradas por ambiente
- healthcheck monitorado

### Seguranca
- chave OpenAI apenas no servidor
- auth Supabase ativa
- rotas da IA protegidas por sessao
- bucket de midias privado
- logs de acesso habilitados no host

### Produto
- login, portfolio, obra, IA e fotos validados
- fluxo mobile testado
- fechamento diario validado
- pendencias e decisoes com dono e prazo validados

### Operacao
- runbook de rollback definido
- processo de onboarding de cliente definido
- processo de suporte definido
- monitoramento de erros definido

## Limites atuais
- a base ainda usa Create React App; para evolucao de longo prazo, considere migrar para Vite ou Next.js
- o rate limiting atual e basico e em memoria; em producao, substitua por Redis ou camada do host
- o modelo de multiempresa e permissao fina ainda precisa ser consolidado no banco antes de escalar

## Comandos uteis
```bash
npm start
npm run build
npm test -- --watch=false
curl -I http://localhost:4173
curl http://localhost:4173/healthz
```
