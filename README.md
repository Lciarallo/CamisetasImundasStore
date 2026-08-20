# 💀 Camisetas Insanas — Black Metal Store

> **Vestidos para o fim** — camisetas de banda de black metal, pronta-entrega e sob encomenda.

E-commerce completo em React + TypeScript + Vite, com vitrine, checkout PIX
multi-etapa e painel administrativo com estatísticas, controle de
privilégios e gestão de estoque.

**No ar:** https://camisetas-imundas-store.web.app

> ⚠️ As bandas são fictícias. O modo local não gera cobrança; uma implantação
> Firebase com o Banco Inter configurado processa PIX real.

---

## 🎨 Identidade

Monocromática por conceito: **breu**, **osso** e **sangue**. Nada mais.

- Tipografia: `UnifrakturMaguntia` (blackletter, marca e estampas), `Cinzel`
  (títulos gravados) e `Inter` (interface).
- **Fotos reais das peças**, com até 4 por produto — a primeira é a capa, o
  resto vira galeria no modal. Sobem por arrastar, colar (Ctrl+V) ou escolher
  arquivo, e são redimensionadas e recomprimidas em WebP antes de guardar
  (ver [Fotos](#fotos)).
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
  criados e ativados pelo painel administrativo.

## 💳 Checkout

Página dedicada em três etapas, no padrão de loja grande, com resumo fixo lateral.

**PIX à vista é a única forma de pagamento.** Não há escolha de método na tela,
porque não há escolha no servidor: `placeOrder` recusa qualquer outro valor.
Cartão exigiria tokenização e responsabilidade sobre dado de portador; boleto,
conciliação de registro bancário. Nenhum dos dois se sustenta sem um PSP
dedicado, e oferecer o botão desabilitado só anunciaria uma promessa vazia.

| Recurso | Detalhe |
|---|---|
| **PIX** | Cobrança dinâmica criada no servidor via InfinitePay, com confirmação automática. |
| **Entrega** | Busca de endereço por CEP via ViaCEP, com preenchimento manual se a API cair. |
| **Validação** | CPF com dígitos verificadores, e-mail, telefone e CEP. |

## 🛡️ Painel administrativo

Acesse em `#/admin`. Quatro cargos, com privilégios padrão e ajuste individual:

| Cargo | Alcance |
|---|---|
| **Mestre** | Tudo. Não pode ser rebaixado, desativado nem removido. |
| **Necromante** | Catálogo, estoque, pedidos e faturamento. |
| **Acólito** | Pedidos e estoque. Sem faturamento. |
| **Servo** | Somente leitura. |

No **modo local** existem quatro contas de demonstração com senha `insanas`
(`mestre@`, `necromante@`, `acolito@` e `servo@camisetasinsanas.com.br`), e a
tela de login traz um atalho para cada uma. Com backend configurado esse atalho
some: ali ele seria um catálogo de e-mails válidos para quem quisesse tentar a
sorte. Em produção, o primeiro Mestre é provisionado por um canal administrativo,
nunca por uma função pública (ver [Backend](#-backend-firebase)).

- **Painel**: faturamento, pedidos, ticket médio e peças vendidas com variação
  contra o período anterior; série diária com crosshair; ranking de peças e
  bandas; divisão por modo de fornecimento; alertas de estoque baixo e fila de
  produção. Recortes de 7, 30 e 90 dias.
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

Sem nenhuma variável de ambiente a loja sobe em **modo local** e funciona
inteira — é o que qualquer clone recebe. Para o backend de verdade, siga a
seção abaixo.

---

## 🔥 Backend (Firebase)

A loja tem dois backends atrás do mesmo contrato
([`src/store/types.ts`](src/store/types.ts)), escolhido uma vez no carregamento
do módulo:

| Modo | Quando | Dados | Total do pedido |
|---|---|---|---|
| **local** | sem `VITE_FIREBASE_*` | navegador; pedidos só em memória | calculado no cliente |
| **firebase** | com as variáveis definidas | Firestore + Cloud Storage | recalculado no servidor |

O painel avisa no topo quando está em modo local, para ninguém confundir
demonstração com loja de verdade.

### O que o servidor garante

O ponto do backend é este: **nada que envolva dinheiro vem do cliente**. Ele
manda só o que quer comprar e para onde enviar.

- **`placeOrder`** é a única porta para criar um pedido. Lê o preço do banco,
  aplica cupom, frete e desconto do PIX, e confere e dá
  baixa no estoque **dentro de uma transação** — duas compras simultâneas da
  última peça não vendem a mesma unidade duas vezes. A chave idempotente evita
  pedidos duplicados quando uma resposta se perde.
- **Reservas PIX vencem em 30 minutos.** O agendador cancela pedidos pendentes e
  devolve o estoque uma única vez. Pedido pago não pode ser cancelado sem um
  fluxo de reembolso.
- **Regras de Firestore e Storage negam por padrão.** Pedido, produto, cupom e
  privilégio não têm escrita de cliente; só as funções, via Admin SDK, escrevem.
- **Privilégios aparecem em custom claims para a interface**, mas operações
  sensíveis e regras consultam também o perfil atual da equipe. Assim, uma
  desativação ou remoção de privilégio vale imediatamente, mesmo com token antigo.
- **Consultas públicas de pedido** exigem número e código opaco de acesso; e-mail,
  CPF e IDs sequenciais sozinhos não expõem PII.
- **O Mestre** não pode ser rebaixado, desativado nem duplicado — qualquer um
  dos três trancaria todo mundo para fora da administração.
- **Senhas** ficam no Firebase Auth, com hash. Nunca em texto puro, nunca no
  nosso banco.

### Pagamento

Produção usa **InfinitePay (Checkout PIX com taxa de 0% para MEI e PJ)**.

O servidor cria a cobrança com o total recalculado e expiração de 30 minutos. O checkout seguro é gerado pela API da InfinitePay (`POST /links`), permitindo pagamento instantâneo por PIX ou cartão sem taxas sobre o recebimento Pix.

**O webhook e o redirecionamento são avisos, não prova.** Qualquer um pode fazer POST na URL, então a notificação só serve para informar quais coordenadas de transação (`order_nsu`, `transaction_nsu`, `slug`) consultar. Quem confirma o pagamento com certeza criptográfica é a consulta que o servidor faz diretamente na API da InfinitePay (`POST /payment_check`) com as credenciais do lojista.

Dinheiro que chega para um pedido que não pode recebê-lo — vencido, cancelado ou com outro valor — vai para `unreconciledPayments` em vez de virar um log e sumir. Só o Mestre lê a lista, e a escrita é exclusiva das funções.

#### Configurando a InfinitePay

Tudo abaixo é feito uma vez:

1. **Obtenha seu handle / tag da InfinitePay** (ex: `ciarallo` da sua conta InfinitePay / InfiniteTag).

2. **Guarde o handle no Secret Manager.** Nunca em `.env` público, nunca no Firestore:

   ```bash
   firebase functions:secrets:set INFINITEPAY_HANDLE
   ```

3. **Configure as URLs opcionais de ambiente** (se desejar especificar a base da loja e o webhook):

   ```bash
   INFINITEPAY_PUBLIC_BASE_URL=https://camisetas-imundas-store.web.app
   INFINITEPAY_WEBHOOK_URL=https://southamerica-east1-SEU-PROJETO.cloudfunctions.net/paymentWebhook
   ```

4. **Publique as funções:**

   ```bash
   firebase deploy --only functions
   ```

5. **Teste com R$ 1,00 de verdade.** Faça um pedido, pague o link de checkout e confirme que o status vira `pago` sozinho.

Sem o `INFINITEPAY_HANDLE`, `placeOrder` **recusa criar o pedido** em produção para evitar emitir links inválidos. No emulador, uma URL simulada e pagamentos de teste podem ser mockados via `INFINITEPAY_EMULATOR_PAID_ORDERS`.

### Emuladores

Não custa nada e não depende do plano Blaze. Precisa de Java.

```bash
cp .env.example .env.local          # preencha e deixe VITE_USE_EMULATORS=true
firebase emulators:start --only auth,firestore,functions,storage
npm run dev
```

Com os emuladores no ar, `node scripts/verify-backend.mjs` roda **83
verificações ponta a ponta** contra eles — pedido forjado, adulteração de preço,
método de pagamento fora do PIX, idempotência, consulta com token, webhook sem
assinatura, privilégio por cargo, conta desativada, estoque sob concorrência e
regras de Storage. Usa o SDK
**cliente** de propósito: o Admin SDK passa por cima das regras.

### Publicando

1. **Ative o plano Blaze** no console do Firebase. Cloud Functions exige cartão
   cadastrado; a cota grátis (2 milhões de chamadas/mês) costuma deixar a conta
   em R$ 0 numa loja deste porte.
2. **Habilite** Firestore, Authentication (provedor e-mail/senha) e Storage.
3. **Registre um app web** e copie as chaves para o `.env.local`. Elas são
   públicas por natureza — vão no bundle e qualquer um lê. O que protege os
   dados são as regras e as funções, nunca o sigilo da `apiKey`.
4. **Configure App Check** com reCAPTCHA Enterprise, preencha
   `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` e habilite a fiscalização no console.
   `placeOrder` e `lookupOrders` exigem App Check por padrão fora do emulador.
5. **Cadastre o segredo do pagamento** no Secret Manager:

   ```bash
   firebase functions:secrets:set INFINITEPAY_HANDLE
   ```

6. Publique:

   ```bash
   firebase deploy --only firestore:rules,storage:rules
   firebase deploy --only functions
   npm run build && firebase deploy --only hosting
   ```

7. A instalação já existente preserva o Mestre atual. Em projeto novo, provisione
   o primeiro Mestre via Firebase Admin SDK/console em um ambiente confiável. A
   callable de bootstrap é intencionalmente limitada aos emuladores para impedir
   que o primeiro visitante tome a instalação.

As funções rodam em `southamerica-east1` (São Paulo), com teto de 10 instâncias
— sem esse teto, um pico ou um laço acidental escala sem limite e a conta chega
junto.

### Três armadilhas deste deploy

Todas custaram tempo na primeira publicação. Ficam registradas porque nenhuma
dá erro óbvio — duas passam despercebidas até alguém usar o painel.

**1. O banco nasce na região errada.** `firebase deploy` cria o Firestore
sozinho se ele não existir, e escolhe `nam5` (multi-região nos EUA). Com as
funções em São Paulo, cada leitura dentro da transação de `placeOrder` cruza o
continente. **A região é permanente**, então crie o banco antes do primeiro
deploy:

```bash
firebase firestore:databases:create "(default)" --location southamerica-east1
```

Se já criou errado e ainda está vazio, dá para apagar e refazer — o nome
`(default)` fica indisponível por ~3 minutos depois da exclusão.

O Storage é o caso oposto: deixe nos **EUA**. O nível gratuito de 5 GB só vale
lá, e foto de produto é baixada uma vez e cacheada na borda — a distância não
entra no caminho crítico como entra no banco.

**2. O primeiro deploy de funções falha em projeto novo.** O erro é
`iam.serviceaccounts.actAs denied on ...-compute@developer.gserviceaccount.com`.
Não é permissão sua: a conta de serviço padrão do Compute é criada de forma
assíncrona quando a API é habilitada, e o deploy chega antes. **Basta repetir.**

**3. `update` não reaplica a permissão de invocação pública.** Esta é a pior,
porque não aparece em nenhum log de deploy. Quando um deploy falha no meio, as
funções que ficaram pela metade são tratadas como *update* nas tentativas
seguintes — e o Firebase só concede o `run.invoker` para `allUsers` no
**create**. O resultado é uma função que responde **403 do Google Frontend**: no
navegador vira erro de CORS, e a tela some sem explicação.

Para conferir, chame cada função direto e veja quem responde:

```bash
curl -s -X POST https://southamerica-east1-SEU-PROJETO.cloudfunctions.net/updateOrderStatus \
  -H "content-type: application/json" -d '{"data":{}}'
```

JSON com `"status":"UNAUTHENTICATED"` é o **seu** código respondendo: está certa.
HTML de `403 Forbidden` é o Google barrando antes: está quebrada. O conserto é
apagar e recriar:

```bash
firebase functions:delete NOME --region southamerica-east1 --force
firebase deploy --only functions
```

Cuidado ao testar pelo SDK: uma chamada barrada pelo Cloud Run chega ao cliente
como `functions/unauthenticated`, **igual** a uma chamada legitimamente sem
login. Só o `curl` acima distingue as duas.

## 🗄️ Persistência

O carrinho fica sempre no navegador: é rascunho do visitante, não dado da loja.
Guardar no servidor exigiria identificar quem não fez login.

No **modo local** todo o resto também vive em `localStorage`, e o histórico de 90
dias de pedidos é gerado por um PRNG com semente fixa — os gráficos não mudam a
cada reload. O botão **Restaurar dados** devolve tudo ao estado inicial.

### Fotos

**Com backend**, o arquivo vai para o **Cloud Storage** e só a URL entra no
documento. Guardar o binário no Firestore esbarraria no teto de 1 MiB por
documento, faria cada listagem baixar megabytes e perderia o cache de CDN.

**Sem backend**, a foto vira data URI dentro do `localStorage`, cuja cota é de
poucos megabytes para o domínio inteiro. Uma foto de celular crua tem 3–8 MB e,
em base64, engorda mais 33% — duas já estourariam tudo.

Nos dois casos nada é guardado como veio:

- reduzida para no máximo **1600px** (Storage) ou **1000px** (navegador);
- recomprimida em WebP (JPEG onde o navegador não exporta WebP), com a qualidade
  caindo em degraus até caber no limite do destino;
- orientação EXIF corrigida via `createImageBitmap`, senão foto tirada com o
  celular deitado chegaria girada;
- teto de 4 fotos por peça.

As regras do Storage repetem a checagem de tipo e tamanho: validação de cliente
serve de conveniência, não de defesa. SVG é recusado — seria um vetor de script
embutido.

## 📦 Peso da página

Checkout e painel entram por `import()`, e do SDK do Firebase só o Firestore vem
no pacote inicial: **Auth, Functions e Storage sobem sob demanda**, então quem só
olha a vitrine nunca baixa o código de login, de chamada de função nem de
upload.

O que sobra são 230 KB gzip, dos quais 134 KB são o Firestore — o motor de tempo
real, que mantém catálogo, pedidos e estoque atualizados sem recarregar. Cortá-lo
significaria trocar o tempo real por refetch manual, o que se paga na vitrine e
se perde no painel; por isso ficou.

## 🧱 Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Firebase (Firestore, Auth,
Storage, Cloud Functions v2) · lucide-react · qrcode · canvas-confetti · oxlint

## 📄 Licença

MIT.
