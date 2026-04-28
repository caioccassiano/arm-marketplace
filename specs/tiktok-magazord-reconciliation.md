# Spec: Conciliação TikTok Shop × Magazord (Upload Manual)

## Objetivo

Upload manual de dois arquivos (TikTok XLSX + Magazord CSV), cruzamento por `Order ID` × `Código Secundário`, resultado exibido inline sem gravar no banco.

**Usuário:** time financeiro que exporta dois relatórios e quer ver imediatamente quais pedidos batem, quais divergem de valor e quais só existem em um dos lados.

**Sucesso:**
- Upload dos dois arquivos → resultado em < 5s
- Cada pedido classificado: MATCH_OK | MATCH_COM_DIVERGENCIA | SOMENTE_TIKTOK | SOMENTE_ERP
- Tabela filtrável por status
- Campo `foi_transacionado` correto (cancelados/não pagos não poluem divergências)

---

## Approach: Stateless (sem banco)

Mesmo padrão do `ManualUpload` já existente. Endpoint recebe arquivos, processa, devolve resultado no próprio response. Sem sessão, sem polling.

---

## Formatos reais dos arquivos

### TikTok — XLSX (exportação "Todos os Pedidos")

| Estrutura | Detalhe |
|---|---|
| Row 1 | Headers |
| Row 2 | Descrições (pular) |
| Row 3+ | Dados reais |
| Observação | Um pedido = múltiplas linhas (uma por SKU) — deduplica por `Order ID` |

**Colunas relevantes:**

| Col | Nome | Exemplo | Uso |
|-----|------|---------|-----|
| 0 | `Order ID` | `583730257272735218` | chave de match |
| 2 | `Order Status` | `Concluído`, `Cancelado`, `A ser enviado`, `Enviado`, `Não pago` | foi_transacionado |
| 23 | `Order Amount` | `BRL 289,13` | valor pago pelo comprador |
| 28 | `Created Time` | `04/27/2026 3:50:05 PM` | data do pedido |

**Parse do valor:** remover `BRL ` + trocar `,` por `.` → `289.13`

**Parse da data:** `MM/DD/YYYY h:mm:ss AM/PM` → Date

### Magazord — CSV

| Estrutura | Detalhe |
|---|---|
| Delimiter | `;` |
| Encoding | `latin-1` (ISO-8859-1) |
| Row 1 | Headers |
| Row 2+ | Dados |

**Colunas relevantes:**

| Col | Nome | Exemplo | Uso |
|-----|------|---------|-----|
| 0 | (sem nome) | `aprovado`, `entregue`, `cancelado` | status legível |
| 5 | `Código Secundário` | `583730257272735218` | chave de match (= TikTok Order ID) |
| 6 | `Data/Hora` | `27/04/2026 16:03:27` | data do pedido |
| 15 | `Situação` | `4 - Aprovado`, `16 - Entregue` | status descritivo |
| 30 | `Valor Total` | `289,13` | valor ERP |

---

## Regra de match

```
TikTok Order ID  ==  Magazord Código Secundário
```

Match exato (string). Sem substring, sem fallback por valor+data.

---

## Campo `foi_transacionado`

```
TRUE   → TikTok: "Concluído" | "A ser enviado" | "Enviado"
FALSE  → TikTok: "Cancelado" | "Não pago"
```

Pedidos com `foi_transacionado = FALSE` e sem Magazord → `status_financeiro = IGNORAR`

---

## Classificação de status

### `status_match`

| Valor | Condição |
|---|---|
| `MATCH_OK` | Existe nos dois lados + `|diferenca| <= 0.01` |
| `MATCH_COM_DIVERGENCIA` | Existe nos dois lados + `|diferenca| > 0.01` |
| `SOMENTE_TIKTOK` | Só no TikTok |
| `SOMENTE_ERP` | Só no Magazord |

### `motivo_divergencia` (só quando MATCH_COM_DIVERGENCIA)

| Valor | Condição |
|---|---|
| `ARREDONDAMENTO` | `|diferenca| < 0.10` |
| `DESCONTO_PLATAFORMA` | diferença ≈ `SKU Platform Discount` (dentro de R$0,10) |
| `NAO_IDENTIFICADO` | nenhuma das anteriores |

### `status_financeiro`

| Valor | Condição |
|---|---|
| `OK` | `MATCH_OK` + `foi_transacionado = TRUE` |
| `DIVERGENTE` | `MATCH_COM_DIVERGENCIA` + `foi_transacionado = TRUE` |
| `A_RECEBER` | `SOMENTE_TIKTOK` + `foi_transacionado = TRUE` |
| `IGNORAR` | `foi_transacionado = FALSE` OU `SOMENTE_ERP` |

---

## Tech Stack

- **XLSX parsing:** `xlsx` (SheetJS) — novo pacote, só no backend
- **CSV parsing:** `src/lib/csv.ts` já existe (mas Magazord tem encoding latin-1 — tratar na rota)
- **Sem novas tabelas no banco**
- Frontend: igual ao padrão `ManualUpload` existente

---

## Arquivos novos/modificados

```
src/routes/upload.ts          → adicionar POST /api/upload/tiktok-reconcile
client/src/pages/ManualUpload.tsx → adicionar aba/modo TikTok
  OU
client/src/pages/TikTokReconciliation.tsx → nova página dedicada
client/src/App.tsx            → nova rota /tiktok
client/src/components/Layout.tsx → novo nav item
package.json                  → adicionar xlsx
```

---

## Critérios de sucesso

- [ ] Upload dos dois arquivos retorna resultado com todos os campos
- [ ] TikTok row 2 (descrições) é ignorada corretamente
- [ ] Múltiplas linhas por Order ID são deduplicadas (usar primeira linha por Order ID)
- [ ] Pedido `Cancelado` ou `Não pago` → `IGNORAR` (não aparece em divergências)
- [ ] Valor `BRL 289,13` → `289.13` corretamente parseado
- [ ] `npx tsc --noEmit` passa em backend e frontend

---

## Fronteiras

### Sempre fazer
- Deduplica TikTok por Order ID antes de qualquer cálculo
- Tolerância R$0,01 (não R$0,05)
- Pular row 2 do TikTok XLSX (descrições)

### Nunca fazer
- Gravar no banco (stateless, como ManualUpload)
- Parsear Order ID como número (sempre string)
- Usar a tabela `reconciliation_sessions` (módulo separado)
