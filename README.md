# 💀 Camisetas Insanas — Black Metal Store

> **Vestidos para o fim** — camisetas de banda de black metal, pronta-entrega e sob encomenda.

E-commerce completo em React + TypeScript + Vite, com vitrine, checkout multi-etapa
(PIX, cartão e boleto) e painel administrativo com estatísticas, controle de
privilégios e gestão de estoque.

> ⚠️ Projeto fictício, para demonstração. As bandas foram inventadas para a loja —
> nenhuma banda real é referenciada. Nenhuma cobrança é processada.

---

## 🎨 Identidade

Monocromática por conceito: **breu**, **osso** e **sangue**. Nada mais.

- Tipografia: `UnifrakturMaguntia` (blackletter, marca e estampas), `Cinzel`
  (títulos gravados) e `Inter` (interface).
- **Estampas em SVG**, não em foto: 10 sigilos desenhados à mão (pentagrama
  invertido, caveira, cruz invertida, baphomet, árvore morta, lua, cálice, corvo,
  espada e olho) aplicados sobre três cores de tecido. Carregam instantâneo,
  ficam nítidos em qualquer tamanho e não dependem de CDN.
- **Cursor temático**: caveira que segue o ponteiro com rastro de brasas e anel
  que persegue com atraso. Reage a elementos clicáveis. Desliga sozinho em toque
  e quando o sistema pede `prefers-reduced-motion` — cursor customizado é
  enfeite, não pode custar usabilidade.
- Grão de filme e vinheta sobre toda a página.

---

## 🛒 Vitrine

- Busca por banda/peça (com normalização de acentos), filtro por categoria,
  ordenação e recorte "só disponíveis".
- Cartão com seletor rápido de tamanho, aviso de escassez e prazo de produção.
- Modal com ficha técnica, tabela de medidas em centímetros e seletor de quantidade.
- Sacola lateral com barra de progresso do frete grátis e cupons
  (`CULTO10`, `INSANA20`).

## 💳 Checkout

Página dedicada em três etapas, no padrão de loja grande, com resumo fixo lateral.

| Recurso | Detalhe |
|---|---|
| **PIX** | BR Code EMV **real**, com CRC16/CCITT-FALSE calculado. O QR abre em app de banco. 5% de desconto à vista. |
| **Cartão** | Detecção de bandeira, validação por **Luhn**, validade e CVV. Parcelamento em 12x — 6x sem juros, tabela Price a partir da 7ª. |
| **Boleto** | Vencimento e prazo de compensação. |
| **Entrega** | Busca de endereço por CEP via ViaCEP, com preenchimento manual se a API cair. |
| **Validação** | CPF com dígitos verificadores, e-mail, telefone e CEP. |

## 🛡️ Painel administrativo

Acesse em `#/admin`. Quatro contas de demonstração, senha `insanas`:

| Cargo | Conta | Alcance |
|---|---|---|
| **Mestre** | `mestre@camisetasinsanas.com.br` | Tudo. Não pode ser rebaixado nem removido. |
| **Necromante** | `necromante@camisetasinsanas.com.br` | Catálogo, estoque, pedidos e faturamento. |
| **Acólito** | `acolito@camisetasinsanas.com.br` | Pedidos e estoque. Sem faturamento. |
| **Servo** | `servo@camisetasinsanas.com.br` | Somente leitura (conta desativada, para testar o bloqueio). |

- **Painel**: faturamento, pedidos, ticket médio e peças vendidas com variação
  contra o período anterior; série diária com crosshair; ranking de peças e
  bandas; divisão por forma de pagamento e por modo de fornecimento; alertas de
  estoque baixo e fila de produção. Recortes de 7, 30 e 90 dias.
- **Pedidos**: busca, filtro por status, esteira que avança um degrau por vez,
  código de rastreio, timeline de alterações e detalhamento de valores.
- **Estoque**: grade por tamanho com ajuste fino, alerta de mínimo e separação
  entre pronta-entrega e sob encomenda.
- **Catálogo**: CRUD completo, incluindo escolha de sigilo, tinta e tecido com
  prévia ao vivo da peça.
- **Usuários**: cargos com privilégios padrão e ajuste individual de cada um dos
  9 privilégios. As abas do painel aparecem conforme o que a conta pode ver.

### 📦 Sob encomenda

Peça esgotada não sai do catálogo — vira sob encomenda. A diferença é real no código:

- não consome estoque na venda (só pronta-entrega dá baixa);
- carrega `productionDays` próprio, que soma no prazo de entrega do pedido;
- aparece separada nos gráficos, na sacola, no checkout e na fila de produção.

---

## 💻 Rodando

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # produção
npm run lint     # oxlint
```

## 🗄️ Persistência

Os dados vivem em `localStorage` atrás de `usePersistentState`, cuja superfície é
a mesma de um `useState`. Trocar por uma API de verdade é mudança local em
[`src/store/StoreContext.tsx`](src/store/StoreContext.tsx), não reescrita.
O botão **Restaurar dados** no painel devolve tudo ao estado inicial.

O histórico de 90 dias de pedidos é gerado por um PRNG com semente fixa — os
gráficos não mudam a cada reload.

## 🧱 Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · lucide-react · qrcode ·
canvas-confetti · oxlint

## 📄 Licença

MIT.
