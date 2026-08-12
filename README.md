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
- **Fotos reais das peças**, com até 4 por produto — a primeira é a capa, o
  resto vira galeria no modal. Sobem por arrastar, colar (Ctrl+V) ou escolher
  arquivo, e são redimensionadas para 1000px e recomprimidas em WebP antes de
  guardar (ver [Persistência](#-persistência)).
- **Estampas em SVG como reserva**: 11 sigilos desenhados à mão (pentagrama,
  heptagrama, caveira, cruz invertida, baphomet, árvore morta, lua, cálice,
  corvo, espada e olho) sobre três cores de tecido. Peça sem foto nunca fica
  sem imagem, e foto e desenho ocupam a mesma caixa — a grade não desalinha.
- **Marca e cursor** usam o traço original: a logo e o pentagrama entram como
  máscara alpha, então a cor vem do CSS e um arquivo só serve claro e escuro.
- **Cursor temático**: o pentagrama desenhado à mão segue o ponteiro com rastro
  de brasas, acende em vermelho sobre o que é clicável e traz um ponto de mira,
  já que o rabisco não tem bico definido. Desliga sozinho em toque e quando o
  sistema pede `prefers-reduced-motion` — cursor customizado é enfeite, não
  pode custar usabilidade.
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
- **Catálogo**: CRUD completo, com upload de fotos (arrastar, colar ou
  escolher), reordenação, definição de capa, e escolha de sigilo, tinta e
  tecido com prévia ao vivo da peça.
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

### Fotos e a cota do navegador

Sem backend, as fotos viram data URI dentro do `localStorage`, cuja cota é de
poucos megabytes para o domínio inteiro. Uma foto de celular crua tem 3–8 MB e,
em base64, engorda mais 33% — duas já estourariam tudo. Por isso nada é guardado
como veio:

- reduzida para no máximo 1000px no maior lado;
- recomprimida em WebP (JPEG onde o navegador não exporta WebP), com a qualidade
  caindo em degraus até caber em 600 KB;
- orientação EXIF corrigida via `createImageBitmap`, senão foto tirada com o
  celular deitado chegaria girada;
- teto de 4 fotos por peça.

Quando mesmo assim o navegador recusa a gravação, o painel avisa em vez de
falhar calado — quem acabou de subir uma foto veria ela sumir no reload sem
nenhuma explicação.

## 🧱 Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · lucide-react · qrcode ·
canvas-confetti · oxlint

## 📄 Licença

MIT.
