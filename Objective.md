# Objective: Motor de Conciliação Financeira — TikTok Shop × Magazord

## Contexto

A empresa vende via TikTok Shop. Os pedidos do TikTok são integrados ao ERP **Magazord**. O problema é que esses dois sistemas **nunca batem automaticamente**, porque:

- O TikTok registra **todos** os pedidos (inclusive cancelados, com falha, com cupom, etc.)
- O Magazord só processa pedidos que **entraram no fluxo real** (faturados, em separação, entregues)
- Os **valores divergem** por causa de descontos, cupons, arredondamentos, frete recalculado e taxas da plataforma

Hoje não existe nenhuma forma de saber, de maneira confiável:
- Se um pedido do TikTok virou dinheiro de verdade
- Se o valor que o TikTok mostra bate com o que entrou no ERP
- Se existe pedido no ERP que não veio do TikTok (outros canais)
- Qual foi o valor realmente liquidado (pago pelo TikTok para a empresa)

---

## O que precisa ser construído

Um **motor de conciliação** que cruza os dados dessas três fontes e gera uma visão unificada por pedido.

### Fontes de dados

| # | Fonte | O que contém |
|---|-------|-------------|
| 1 | **TikTok Shop** (API ou CSV exportado) | Todos os pedidos: `order_id`, status, valor bruto, desconto, taxa, valor líquido, data |
| 2 | **Magazord** (API ou CSV exportado) | Pedidos integrados: `id_secundario` (= order_id do TikTok), status ERP, valor faturado |
| 3 | **Relatório de Repasse do TikTok** (CSV) | O que foi efetivamente pago: `order_id`, valor recebido, data de liquidação |

---

## Regra de MATCH entre os sistemas

O campo que conecta os dois sistemas é:

- **TikTok Shop** → `order_id`
- **Magazord** → `id_secundario`

O cruzamento deve ser feito por esses dois campos (LEFT JOIN do TikTok como base).

---

## Tabela unificada: `tiktok_magazord_conciliacao`

Cada linha representa **um pedido**. Campos obrigatórios:

| Campo | Descrição |
|-------|-----------|
| `order_id` | ID do pedido no TikTok (chave primária da conciliação) |
| `id_secundario` | ID do pedido no Magazord (pode ser nulo se não integrou) |
| `status_tiktok` | Status do pedido no TikTok (ex: DELIVERED, CANCELLED, AWAITING_SHIPMENT) |
| `status_magazord` | Status do pedido no ERP (ex: faturado, cancelado, em separação) |
| `valor_tiktok_bruto` | Valor original do pedido no TikTok |
| `valor_tiktok_liquido` | Valor após descontos e taxas da plataforma |
| `valor_erp_liquido` | Valor registrado no Magazord |
| `diferenca_valor` | `valor_tiktok_liquido - valor_erp_liquido` |
| `foi_transacionado` | Boolean — se o pedido gerou movimento financeiro real |
| `valor_recebido_real` | Valor do repasse financeiro do TikTok (fonte 3) |
| `data_recebimento` | Data em que o TikTok liquidou o pagamento |
| `status_match` | Classificação do cruzamento (ver abaixo) |
| `status_financeiro` | Classificação financeira final (ver abaixo) |
| `motivo_divergencia` | Classificação automática da causa da diferença (ver abaixo) |

---

## Classificação de MATCH (`status_match`)

| Status | Condição |
|--------|----------|
| `MATCH_OK` | Pedido existe nos dois sistemas **e** `diferenca_valor = 0` |
| `MATCH_COM_DIVERGENCIA` | Existe nos dois sistemas **mas** `diferenca_valor ≠ 0` |
| `SOMENTE_TIKTOK` | Está no TikTok, **não** existe no Magazord (cancelado, falhou na integração, não processado) |
| `SOMENTE_ERP` | Está no Magazord, **não** veio do TikTok (outros canais de venda) |

---

## Campo `foi_transacionado`

Nem todo pedido = dinheiro. Esse campo indica se o pedido gerou ou vai gerar movimento financeiro real.

**Regra:**

```
foi_transacionado = TRUE
  se status_tiktok IN ('DELIVERED', 'COMPLETED')
  OU status_magazord IN ('faturado', 'entregue')

foi_transacionado = FALSE
  se status_tiktok IN ('CANCELLED', 'UNPAID', 'FAILED')
  OU pedido só existe no TikTok e está cancelado
```

---

## Classificação de divergência (`motivo_divergencia`)

Quando `diferenca_valor ≠ 0`, o sistema deve tentar classificar automaticamente a causa:

| Motivo | Quando aplicar |
|--------|---------------|
| `CUPOM_DESCONTO` | Diferença próxima ao valor de cupom registrado no TikTok |
| `TAXA_PLATAFORMA` | Diferença equivale a % de comissão do TikTok |
| `FRETE_RECALCULADO` | Diferença no campo de frete entre os dois sistemas |
| `ARREDONDAMENTO` | Diferença menor que R$ 0,10 |
| `NAO_IDENTIFICADO` | Não se encaixa em nenhuma das categorias acima |

---

## Classificação financeira final (`status_financeiro`)

| Status | Condição |
|--------|----------|
| `OK` | `MATCH_OK` + `foi_transacionado = TRUE` + valor recebido confere |
| `A_RECEBER` | `foi_transacionado = TRUE` mas ainda sem repasse registrado |
| `DIVERGENTE` | Existe diferença de valor não explicada entre TikTok, ERP ou repasse |
| `IGNORAR` | Pedido cancelado, falhou ou não é do canal TikTok |

---

## Dashboard / Relatório de saída

O sistema deve gerar uma visão consolidada com:

| Métrica | Descrição |
|---------|-----------|
| Total vendido TikTok | Soma de `valor_tiktok_liquido` dos pedidos `foi_transacionado = TRUE` |
| Total registrado ERP | Soma de `valor_erp_liquido` dos pedidos com match |
| Total recebido | Soma de `valor_recebido_real` |
| Total divergência | Soma de `diferenca_valor` dos pedidos `DIVERGENTE` |
| Pedidos não conciliados | Contagem de `SOMENTE_TIKTOK` com `foi_transacionado = TRUE` |
| Pedidos só no ERP | Contagem de `SOMENTE_ERP` |

---

## Fluxo esperado do sistema

```
1. Importar pedidos do TikTok (todos os status)
2. Importar pedidos do Magazord
3. Importar relatório de repasse financeiro do TikTok
4. Fazer o MATCH por order_id × id_secundario
5. Calcular diferenca_valor
6. Classificar status_match
7. Classificar foi_transacionado
8. Classificar motivo_divergencia
9. Classificar status_financeiro
10. Gerar tabela unificada tiktok_magazord_conciliacao
11. Gerar dashboard com os totais consolidados
```

---

## Premissas importantes para o dev

- A base do projeto já está criada — esse módulo é um **novo feature** a ser adicionado
- Os dados podem vir via **API ou CSV** (o dev deve suportar os dois)
- Os valores monetários são em **BRL (R$)**
- A diferença de valor deve usar tolerância de **R$ 0,01** para evitar falsos positivos por arredondamento de ponto flutuante
- O `order_id` do TikTok é sempre uma **string numérica longa** — tratar como string, não como inteiro
- Pedidos com `status_tiktok = CANCELLED` e sem correspondência no ERP devem ser classificados como `IGNORAR` automaticamente, sem exigir revisão manual
