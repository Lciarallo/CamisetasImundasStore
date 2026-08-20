/**
 * Verificação ponta a ponta do backend, contra os emuladores.
 *
 * Usa o SDK **cliente** de propósito. O Admin SDK passa por cima das regras de
 * segurança, então testar com ele provaria muito pouco: o que interessa aqui é
 * exatamente o que um navegador — inclusive um navegador hostil — consegue
 * fazer.
 *
 * Como rodar:
 *   firebase emulators:start --only auth,firestore,functions,storage
 *   node scripts/verify-backend.mjs
 *
 * Cada execução parte de um banco limpo (o script apaga tudo pela API REST do
 * emulador antes de começar), então pode rodar quantas vezes quiser.
 */
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

const PROJECT_ID = 'camisetas-imundas-store';
const REGION = 'southamerica-east1';
const HOST = '127.0.0.1';

/* -------------------------------------------------------------------------- */
/* Mínimo de infraestrutura de teste                                          */
/* -------------------------------------------------------------------------- */

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Espera que a promessa falhe, e devolve o código do erro. */
async function denied(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error?.code ?? error?.message ?? 'erro';
  }
}

const close = (a, b) => Math.abs(a - b) < 0.005;

/* -------------------------------------------------------------------------- */
/* Limpeza                                                                    */
/* -------------------------------------------------------------------------- */

async function wipe() {
  await fetch(
    `http://${HOST}:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await fetch(`http://${HOST}:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

/**
 * O limitador é distribuído no Firestore e, no emulador, todos os cenários
 * partem do mesmo IP. Limpar apenas seus buckets entre grupos mantém cada
 * grupo abaixo do limite real sem apagar os dados funcionais do teste.
 */
async function clearRateLimits() {
  const base = `http://${HOST}:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  // `owner` é o token administrativo reservado do Firestore Emulator. Ele não
  // existe em produção e permite que a infraestrutura do teste limpe buckets
  // que, corretamente, são invisíveis para o SDK cliente.
  const headers = { Authorization: 'Bearer owner' };
  const response = await fetch(`${base}/rateLimits?pageSize=100`, { headers });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`Falha ao limpar rate limits (${response.status}).`);
  const body = await response.json();
  await Promise.all(
    (body.documents ?? []).map((entry) =>
      fetch(`http://${HOST}:8080/v1/${entry.name}`, { method: 'DELETE', headers }),
    ),
  );
}

const orderKey = (label) => `verify_${label}_${'x'.repeat(24)}`;

/* -------------------------------------------------------------------------- */
/* Dados de apoio                                                             */
/* -------------------------------------------------------------------------- */

const product = (over = {}) => ({
  name: 'Peça de teste',
  band: 'Teste',
  category: 'Camiseta',
  price: 100,
  art: { sigil: 'pentagram', tone: 'bone', fabric: 'preto' },
  photos: [],
  rating: 5,
  reviewsCount: 0,
  description: '',
  details: [],
  fulfillment: 'pronta-entrega',
  stock: { P: 5, M: 5, G: 5, GG: 5, XGG: 5 },
  madeToOrderSizes: [],
  lowStockThreshold: 2,
  active: true,
  createdAt: new Date().toISOString(),
  ...over,
});

const buyer = {
  customer: {
    name: 'Cliente Teste',
    email: 'cliente@example.com',
    // CPF com dígitos verificadores válidos.
    cpf: '529.982.247-25',
    phone: '(31) 99999-0000',
  },
  address: {
    cep: '30110-000',
    street: 'Rua das Sombras',
    number: '13',
    district: 'Centro',
    city: 'Belo Horizonte',
    state: 'MG',
  },
};

/* -------------------------------------------------------------------------- */

async function main() {
  await wipe();

  const app = initializeApp({
    apiKey: 'demo-emulator-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.firebasestorage.app`,
    appId: '1:0:web:emulator',
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, HOST, 5001);
  const bucket = getStorage(app);
  connectStorageEmulator(bucket, HOST, 9199);

  const call = (name) => httpsCallable(fns, name);

  /* ---------------------------------------------------------------------- */
  section('Instalação');

  const bootstrapResult = await call('bootstrap')({
    name: 'Mestre Teste',
    email: 'mestre@example.com',
    password: 'segredo123',
  });
  check('bootstrap cria o primeiro Mestre', bootstrapResult.data?.role === 'mestre');

  const secondBootstrap = await denied(
    call('bootstrap')({ name: 'Intruso', email: 'x@example.com', password: 'segredo123' }),
  );
  check(
    'bootstrap se fecha depois do primeiro uso',
    secondBootstrap === 'functions/failed-precondition',
    `veio ${secondBootstrap}`,
  );

  /* ---------------------------------------------------------------------- */
  section('Autenticação e privilégios');

  const mestre = await signInWithEmailAndPassword(auth, 'mestre@example.com', 'segredo123');
  const token = await mestre.user.getIdTokenResult(true);
  check('login do Mestre traz a claim de cargo', token.claims.role === 'mestre');
  check('claim traz os 9 privilégios', token.claims.perms?.length === 9);
  check('claim marca a conta como ativa', token.claims.active === true);

  /* ---------------------------------------------------------------------- */
  section('Catálogo');

  await call('seedCatalog')({
    products: [
      { id: 'p-normal', product: product({ name: 'Peça normal', price: 149.9 }) },
      {
        id: 'p-rascunho',
        product: product({ name: 'Rascunho', active: false }),
      },
      {
        id: 'p-ultima',
        product: product({ name: 'Última peça', price: 200, stock: { M: 1 } }),
      },
      {
        id: 'p-encomenda',
        product: product({
          name: 'Sob encomenda',
          price: 189,
          fulfillment: 'sob-encomenda',
          madeToOrderSizes: ['M', 'G'],
          productionDays: 15,
          stock: { M: 99 },
        }),
      },
    ],
    coupons: [{ code: 'CULTO10', coupon: { percent: 10, minSubtotal: 100, active: true } }],
  });

  const seeded = await getDoc(doc(db, 'products', 'p-encomenda'));
  check(
    'sanitizador zera o estoque de peça sob encomenda',
    Object.keys(seeded.data()?.stock ?? {}).length === 0,
  );
  check('sanitizador mantém os tamanhos fabricados', seeded.data()?.madeToOrderSizes?.length === 2);

  const savedCoupon = await call('saveCoupon')({
    code: 'futuro15',
    coupon: { percent: 15, minSubtotal: 200, active: false },
  });
  const couponDoc = await getDoc(doc(db, 'coupons', 'FUTURO15'));
  check('painel normaliza e salva cupom', savedCoupon.data?.code === 'FUTURO15' && couponDoc.exists());
  check('cupom novo preserva estado inativo', couponDoc.data()?.active === false);

  const unsafeCoupon = await denied(
    call('saveCoupon')({ code: 'ERRO90', coupon: { percent: 90, minSubtotal: 0, active: true } }),
  );
  check('desconto acima de 80% é recusado', unsafeCoupon === 'functions/invalid-argument');

  await call('deleteCoupon')({ code: 'FUTURO15' });
  check('painel exclui cupom', !(await getDoc(doc(db, 'coupons', 'FUTURO15'))).exists());

  const withPhoto = await denied(
    call('saveProduct')({
      id: 'p-foto',
      product: product({ photos: ['https://evil.example.com/rastreador.png'] }),
    }),
  );
  const photoDoc = withPhoto ? null : await getDoc(doc(db, 'products', 'p-foto'));
  check(
    'foto de domínio externo é descartada',
    photoDoc ? (photoDoc.data()?.photos ?? []).length === 0 : false,
    withPhoto ?? '',
  );

  /* ---------------------------------------------------------------------- */
  section('Regras de segurança (cliente sem privilégio)');

  await signOut(auth);

  const publicList = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
  check('vitrine lê as peças ativas', publicList.size >= 3);

  const draftRead = await denied(getDoc(doc(db, 'products', 'p-rascunho')));
  check(
    'rascunho é invisível para quem não tem privilégio',
    draftRead === 'permission-denied',
    `veio ${draftRead}`,
  );

  const listAll = await denied(getDocs(collection(db, 'products')));
  check(
    'listar o catálogo inteiro (com rascunhos) é negado',
    listAll === 'permission-denied',
    `veio ${listAll}`,
  );

  const forgedOrder = await denied(
    addDoc(collection(db, 'orders'), { total: 0.01, status: 'pago' }),
  );
  check(
    'escrever pedido direto no banco é negado',
    forgedOrder === 'permission-denied',
    `veio ${forgedOrder}`,
  );

  const forgedPrice = await denied(updateDoc(doc(db, 'products', 'p-normal'), { price: 1 }));
  check(
    'adulterar preço direto no banco é negado',
    forgedPrice === 'permission-denied',
    `veio ${forgedPrice}`,
  );

  const forgedClaim = await denied(
    setDoc(doc(db, 'adminUsers', 'invasor'), { role: 'mestre', active: true }),
  );
  check(
    'criar administrador direto no banco é negado',
    forgedClaim === 'permission-denied',
    `veio ${forgedClaim}`,
  );

  const ordersRead = await denied(getDocs(collection(db, 'orders')));
  check('ler pedidos sem privilégio é negado', ordersRead === 'permission-denied');

  const callWithoutAuth = await denied(call('saveProduct')({ id: 'x', product: product() }));
  check(
    'chamar função de catálogo sem login é negado',
    callWithoutAuth === 'functions/unauthenticated',
    `veio ${callWithoutAuth}`,
  );

  const couponWithoutAuth = await denied(
    call('saveCoupon')({ code: 'INVASOR', coupon: { percent: 50, minSubtotal: 0, active: true } }),
  );
  check('criar cupom sem login é negado', couponWithoutAuth === 'functions/unauthenticated');

  /* ---------------------------------------------------------------------- */
  section('Fechamento de pedido — o cliente não decide o preço');

  // Mesmo mandando preço, desconto e total forjados, o servidor ignora tudo.
  const forgedKey = orderKey('preco_servidor');
  const forged = await call('placeOrder')({
    ...buyer,
    idempotencyKey: forgedKey,
    items: [{ productId: 'p-normal', size: 'M', quantity: 2, unitPrice: 1, price: 1 }],
    payment: { method: 'pix' },
    subtotal: 2,
    total: 0.01,
    shipping: 0,
    discount: 999,
  });
  const order = forged.data;

  // 149,90 × 2 = 299,80 → passa do teto de frete grátis (299).
  check('subtotal vem do banco, não do cliente', close(order.subtotal, 299.8), `${order.subtotal}`);
  check('frete grátis acima de R$ 299', order.shipping === 0);
  check('total forjado é ignorado', close(order.total, 299.8), `${order.total}`);
  check('desconto forjado é ignorado', close(order.discount, 0), `${order.discount}`);
  check('PIX nasce aguardando confirmação', order.status === 'aguardando-pagamento');
  check('cobrança de pagamento é gerada só depois do pedido', typeof (order.payment?.checkoutUrl ?? order.payment?.pixCode) === 'string');
  check('token opaco volta somente ao checkout', order.customerAccessToken === forgedKey);
  check('número do pedido é sequencial', /^INS-\d+$/.test(order.id), order.id);

  const afterFirst = await getDoc(doc(db, 'products', 'p-normal'));
  check('estoque baixou 2 unidades', afterFirst.data()?.stock?.M === 3, `${afterFirst.data()?.stock?.M}`);

  const repeated = await call('placeOrder')({
    ...buyer,
    idempotencyKey: forgedKey,
    items: [{ productId: 'p-normal', size: 'M', quantity: 2, unitPrice: 1, price: 1 }],
    payment: { method: 'pix' },
    subtotal: 2,
    total: 0.01,
    shipping: 0,
    discount: 999,
  });
  const afterRepeated = await getDoc(doc(db, 'products', 'p-normal'));
  check('retry idempotente devolve o mesmo pedido', repeated.data.id === order.id);
  check(
    'retry idempotente não baixa o estoque outra vez',
    afterRepeated.data()?.stock?.M === 3,
    `${afterRepeated.data()?.stock?.M}`,
  );

  const reusedForAnotherCart = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: forgedKey,
      items: [{ productId: 'p-normal', size: 'M', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check(
    'a mesma chave não pode autorizar outro payload',
    reusedForAnotherCart === 'functions/already-exists',
    `veio ${reusedForAnotherCart}`,
  );

  // A loja é PIX à vista. Nenhuma tela oferece outro método, então qualquer
  // outro valor aqui é payload forjado — e o servidor precisa recusar sozinho.
  for (const [label, method] of [
    ['cartão', 'cartao'],
    ['boleto', 'boleto'],
    ['método desconhecido', 'cripto'],
  ]) {
    const refused = await denied(
      call('placeOrder')({
        ...buyer,
        idempotencyKey: orderKey(`metodo_${method}`),
        items: [{ productId: 'p-normal', size: 'G', quantity: 1 }],
        payment: { method },
      }),
    );
    check(
      `${label} é recusado: a loja só cobra por PIX`,
      refused === 'functions/invalid-argument',
      `veio ${refused}`,
    );
  }

  const missingMethod = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: orderKey('metodo_ausente'),
      items: [{ productId: 'p-normal', size: 'G', quantity: 1 }],
    }),
  );
  check(
    'pedido sem forma de pagamento é recusado',
    missingMethod === 'functions/invalid-argument',
    `veio ${missingMethod}`,
  );

  /* --- Consulta pública --------------------------------------------------- */
  section('Consulta de pedido — número e segredo opaco');

  const withoutToken = await call('lookupOrders')({ orderId: order.id });
  check('número sequencial sozinho não expõe o pedido', withoutToken.data.orders?.length === 0);

  const wrongToken = await call('lookupOrders')({
    orderId: order.id,
    accessToken: orderKey('token_incorreto'),
  });
  check('token incorreto não expõe o pedido', wrongToken.data.orders?.length === 0);

  const rightToken = await call('lookupOrders')({ orderId: order.id, accessToken: forgedKey });
  check('número e token corretos devolvem o pedido', rightToken.data.orders?.[0]?.id === order.id);
  check(
    'hash do token nunca é devolvido ao cliente',
    rightToken.data.orders?.[0]?.customerAccessTokenHash === undefined,
  );

  const emailLookup = await denied(call('lookupOrders')({ email: buyer.customer.email }));
  check('busca pública por e-mail foi removida', emailLookup === 'functions/invalid-argument');
  const cpfLookup = await denied(call('lookupOrders')({ cpf: buyer.customer.cpf }));
  check('busca pública por CPF foi removida', cpfLookup === 'functions/invalid-argument');

  await clearRateLimits();

  /* --- PIX, cupom e frete ------------------------------------------------ */
  const pix = await call('placeOrder')({
    ...buyer,
    idempotencyKey: orderKey('pix_cupom'),
    items: [{ productId: 'p-normal', size: 'P', quantity: 1 }],
    payment: { method: 'pix' },
    coupon: 'culto10',
  });
  // 149,90 − 10% = 134,91 + frete 24,90 = 159,81
  check('cupom é aplicado em caixa-alta', pix.data.coupon === 'CULTO10');
  check('frete cobrado abaixo do teto', close(pix.data.shipping, 24.9));
  check('PIX não adiciona desconto automático', close(pix.data.total, 159.81), `${pix.data.total}`);

  const badCoupon = await call('placeOrder')({
    ...buyer,
    idempotencyKey: orderKey('cupom_invalido'),
    items: [{ productId: 'p-normal', size: 'P', quantity: 1 }],
    payment: { method: 'pix' },
    coupon: 'NAOEXISTE',
  });
  check('cupom inválido não derruba a compra', badCoupon.data.coupon === null);

  const cancelMe = await call('placeOrder')({
    ...buyer,
    idempotencyKey: orderKey('cancelamento'),
    items: [{ productId: 'p-normal', size: 'XGG', quantity: 1 }],
    payment: { method: 'pix' },
  });

  /* --- Limites ------------------------------------------------------------ */
  const overLine = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: orderKey('quantidade_alta'),
      items: [{ productId: 'p-normal', size: 'M', quantity: 99 }],
      payment: { method: 'pix' },
    }),
  );
  check('quantidade acima do teto é recusada', overLine === 'functions/invalid-argument');

  const draftBuy = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: orderKey('rascunho'),
      items: [{ productId: 'p-rascunho', size: 'M', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check(
    'comprar peça fora do catálogo é recusado',
    draftBuy === 'functions/failed-precondition',
    `veio ${draftBuy}`,
  );

  await clearRateLimits();

  const badSize = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: orderKey('tamanho_invalido'),
      items: [{ productId: 'p-encomenda', size: 'XGG', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check(
    'tamanho não fabricado é recusado na peça sob encomenda',
    badSize === 'functions/failed-precondition',
    `veio ${badSize}`,
  );

  const badCpf = await denied(
    call('placeOrder')({
      ...buyer,
      idempotencyKey: orderKey('cpf_invalido'),
      customer: { ...buyer.customer, cpf: '111.111.111-11' },
      items: [{ productId: 'p-normal', size: 'M', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check('CPF inválido é recusado', badCpf === 'functions/invalid-argument');

  /* --- Concorrência: última peça ------------------------------------------ */
  section('Estoque sob concorrência');

  await clearRateLimits();

  const race = await Promise.allSettled(
    Array.from({ length: 5 }, (_, index) =>
      call('placeOrder')({
        ...buyer,
        idempotencyKey: orderKey(`corrida_${index}`),
        items: [{ productId: 'p-ultima', size: 'M', quantity: 1 }],
        payment: { method: 'pix' },
      }),
    ),
  );
  const won = race.filter((r) => r.status === 'fulfilled').length;
  check('5 compras simultâneas da última peça: só 1 passa', won === 1, `passaram ${won}`);

  const soldOut = await getDoc(doc(db, 'products', 'p-ultima'));
  check('estoque termina em zero, nunca negativo', soldOut.data()?.stock?.M === 0, `${soldOut.data()?.stock?.M}`);

  /* ---------------------------------------------------------------------- */
  section('Operação e privilégios por cargo');

  await signInWithEmailAndPassword(auth, 'mestre@example.com', 'segredo123');

  const beforeCancellation = await getDoc(doc(db, 'products', 'p-normal'));
  await call('updateOrderStatus')({ orderId: cancelMe.data.id, status: 'cancelado' });
  const afterCancellation = await getDoc(doc(db, 'products', 'p-normal'));
  check(
    'cancelar PIX pendente devolve a reserva ao estoque',
    afterCancellation.data()?.stock?.XGG === beforeCancellation.data()?.stock?.XGG + 1,
  );
  const cancelAgain = await denied(
    call('updateOrderStatus')({ orderId: cancelMe.data.id, status: 'cancelado' }),
  );
  const afterSecondCancellation = await getDoc(doc(db, 'products', 'p-normal'));
  check('cancelar pedido encerrado outra vez é recusado', cancelAgain === 'functions/failed-precondition');
  check(
    'tentativa repetida de cancelamento não duplica estoque',
    afterSecondCancellation.data()?.stock?.XGG === afterCancellation.data()?.stock?.XGG,
  );

  const paidOrder = order.id;
  await call('updateOrderStatus')({ orderId: paidOrder, status: 'pago' });
  const paidSnapshot = await getDoc(doc(db, 'orders', paidOrder));
  check(
    'confirmação manual mantém o estado do pagamento consistente',
    paidSnapshot.data()?.payment?.status === 'aprovado' &&
      paidSnapshot.data()?.payment?.confirmedManually === true,
  );
  const stockBeforePaidCancel = (await getDoc(doc(db, 'products', 'p-normal'))).data()?.stock?.M;
  const paidCancel = await denied(
    call('updateOrderStatus')({ orderId: paidOrder, status: 'cancelado' }),
  );
  const stockAfterPaidCancel = (await getDoc(doc(db, 'products', 'p-normal'))).data()?.stock?.M;
  check(
    'pedido pago não é cancelado sem fluxo de reembolso',
    paidCancel === 'functions/failed-precondition',
    `veio ${paidCancel}`,
  );
  check(
    'cancelamento recusado de pedido pago não repõe estoque',
    stockAfterPaidCancel === stockBeforePaidCancel,
  );
  const skipStep = await denied(
    call('updateOrderStatus')({ orderId: paidOrder, status: 'entregue' }),
  );
  check(
    'pular etapas do pedido é recusado',
    skipStep === 'functions/failed-precondition',
    `veio ${skipStep}`,
  );

  await call('updateOrderStatus')({ orderId: paidOrder, status: 'em-producao' });
  const advanced = await getDoc(doc(db, 'orders', paidOrder));
  check('status avança um degrau', advanced.data()?.status === 'em-producao');
  check('histórico registra quem mudou', advanced.data()?.history?.at(-1)?.by === 'Mestre Teste');

  // Um "servo" só enxerga; não pode mexer em catálogo nem em pedido.
  await call('saveStaff')({
    name: 'Servo Teste',
    email: 'servo@example.com',
    password: 'segredo123',
    role: 'servo',
    permissions: ['products.view', 'orders.view'],
    active: true,
  });

  const demoteMestre = await denied(
    call('saveStaff')({
      uid: mestre.user.uid,
      name: 'Mestre Teste',
      email: 'mestre@example.com',
      role: 'servo',
      permissions: ['products.view'],
      active: true,
    }),
  );
  check(
    'rebaixar o Mestre é recusado',
    demoteMestre === 'functions/failed-precondition',
    `veio ${demoteMestre}`,
  );

  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'servo@example.com', 'segredo123');
  const servoToken = await auth.currentUser.getIdTokenResult(true);
  check('servo recebe só 2 privilégios', servoToken.claims.perms?.length === 2, `${servoToken.claims.perms}`);

  const servoEdit = await denied(call('saveProduct')({ id: 'p-x', product: product() }));
  check(
    'servo não edita catálogo',
    servoEdit === 'functions/permission-denied',
    `veio ${servoEdit}`,
  );

  const servoStatus = await denied(
    call('updateOrderStatus')({ orderId: paidOrder, status: 'enviado' }),
  );
  check('servo não muda status de pedido', servoStatus === 'functions/permission-denied');

  const servoStaff = await denied(
    call('saveStaff')({
      name: 'Eu mesmo Mestre',
      email: 'golpe@example.com',
      password: 'segredo123',
      role: 'mestre',
      permissions: [],
      active: true,
    }),
  );
  check('servo não cria administrador', servoStaff === 'functions/permission-denied');

  const servoSeesDraft = await getDoc(doc(db, 'products', 'p-rascunho'));
  check('servo enxerga rascunho (tem products.view)', servoSeesDraft.exists());

  /* --- Conta desativada --------------------------------------------------- */
  section('Conta desativada');

  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'mestre@example.com', 'segredo123');
  const servoDoc = (await getDocs(collection(db, 'adminUsers'))).docs.find(
    (d) => d.data().email === 'servo@example.com',
  );
  await call('saveStaff')({
    uid: servoDoc.id,
    name: 'Servo Teste',
    email: 'servo@example.com',
    role: 'servo',
    permissions: ['products.view', 'orders.view'],
    active: false,
  });

  await signOut(auth);
  const disabledLogin = await denied(
    signInWithEmailAndPassword(auth, 'servo@example.com', 'segredo123'),
  );
  check(
    'conta desativada não consegue mais entrar',
    disabledLogin === 'auth/user-disabled',
    `veio ${disabledLogin}`,
  );

  // Reativa e confere o outro caminho: a claim volta a valer no login seguinte.
  await signInWithEmailAndPassword(auth, 'mestre@example.com', 'segredo123');
  await call('saveStaff')({
    uid: servoDoc.id,
    name: 'Servo Teste',
    email: 'servo@example.com',
    role: 'servo',
    permissions: ['products.view', 'orders.view'],
    active: true,
  });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'servo@example.com', 'segredo123');
  const revived = await auth.currentUser.getIdTokenResult(true);
  check('reativar devolve o acesso', revived.claims.active === true);

  // Desativar a própria conta trancaria o administrador para fora.
  await signOut(auth);
  const master = await signInWithEmailAndPassword(auth, 'mestre@example.com', 'segredo123');
  const selfOff = await denied(
    call('saveStaff')({
      uid: master.user.uid,
      name: 'Mestre Teste',
      email: 'mestre@example.com',
      role: 'mestre',
      permissions: [],
      active: false,
    }),
  );
  check(
    'desativar a própria conta é recusado',
    selfOff === 'functions/failed-precondition',
    `veio ${selfOff}`,
  );

  /* ---------------------------------------------------------------------- */
  section('Fotos (Cloud Storage)');

  // PNG 1×1 de verdade — as regras conferem o content type, e o emulador
  // recusa upload sem corpo.
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  const upload = await uploadBytes(storageRef(bucket, 'products/p-normal/capa.png'), pixel, {
    contentType: 'image/png',
  });
  check('Mestre envia foto para a pasta da peça', Boolean(upload.ref));

  const url = await getDownloadURL(upload.ref);
  check(
    'a foto volta como URL do bucket',
    url.includes('/products%2Fp-normal%2Fcapa.png'),
    url,
  );

  const wrongType = await denied(
    uploadBytes(storageRef(bucket, 'products/p-normal/script.svg'), Buffer.from('<svg/>'), {
      contentType: 'image/svg+xml',
    }),
  );
  check(
    'SVG é recusado (vetor de script embutido)',
    wrongType === 'storage/unauthorized',
    `veio ${wrongType}`,
  );

  const tooBig = await denied(
    uploadBytes(
      storageRef(bucket, 'products/p-normal/enorme.png'),
      Buffer.alloc(3 * 1024 * 1024),
      { contentType: 'image/png' },
    ),
  );
  check('arquivo acima de 2 MB é recusado', tooBig === 'storage/unauthorized', `veio ${tooBig}`);

  const outsideProducts = await denied(
    uploadBytes(storageRef(bucket, 'qualquer/lugar.png'), pixel, { contentType: 'image/png' }),
  );
  check(
    'escrever fora de products/ é recusado',
    outsideProducts === 'storage/unauthorized',
    `veio ${outsideProducts}`,
  );

  // Duas fotos na peça, depois só uma: a outra tem de sumir do bucket.
  const segunda = await uploadBytes(storageRef(bucket, 'products/p-normal/verso.png'), pixel, {
    contentType: 'image/png',
  });
  const urlSegunda = await getDownloadURL(segunda.ref);

  await call('saveProduct')({
    id: 'p-normal',
    product: product({ name: 'Peça normal', price: 149.9, photos: [url, urlSegunda] }),
  });
  const comDuas = await getDoc(doc(db, 'products', 'p-normal'));
  check('as duas fotos ficam gravadas na peça', comDuas.data()?.photos?.length === 2, `${comDuas.data()?.photos?.length}`);

  await call('saveProduct')({
    id: 'p-normal',
    product: product({ name: 'Peça normal', price: 149.9, photos: [url] }),
  });
  const comUma = await getDoc(doc(db, 'products', 'p-normal'));
  check('remover a foto atualiza a peça', comUma.data()?.photos?.length === 1);

  const orfa = await denied(getDownloadURL(storageRef(bucket, 'products/p-normal/verso.png')));
  check(
    'a foto removida some do bucket, sem deixar órfã',
    orfa === 'storage/object-not-found',
    `veio ${orfa}`,
  );

  const capaViva = await denied(getDownloadURL(storageRef(bucket, 'products/p-normal/capa.png')));
  check('a foto que ficou continua no bucket', capaViva === null);

  await signOut(auth);
  const anonUpload = await denied(
    uploadBytes(storageRef(bucket, 'products/p-normal/invasor.png'), pixel, {
      contentType: 'image/png',
    }),
  );
  check(
    'visitante não envia foto',
    anonUpload === 'storage/unauthorized',
    `veio ${anonUpload}`,
  );

  /* ---------------------------------------------------------------------- */
  section('Pagamento');

  const webhookNoSecret = await fetch(
    `http://${HOST}:5001/${PROJECT_ID}/${REGION}/paymentWebhook`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: pix.data.id, status: 'paid' }),
    },
  );
  check(
    'webhook sem prova válida é recebido sem promover o pedido',
    webhookNoSecret.status === 200,
    `veio ${webhookNoSecret.status}`,
  );

  const afterForgedWebhook = await call('lookupOrders')({
    orderId: pix.data.id,
    accessToken: pix.data.customerAccessToken,
  });
  check(
    'webhook recusado não confirma o pagamento',
    afterForgedWebhook.data.orders?.[0]?.status === 'aguardando-pagamento',
    `veio ${afterForgedWebhook.data.orders?.[0]?.status}`,
  );

  /* ---------------------------------------------------------------------- */
  console.log(
    `\n\x1b[1m${passed} verificações passaram, ${failures.length} falharam.\x1b[0m`,
  );
  if (failures.length) {
    failures.forEach((name) => console.log(`  \x1b[31m·\x1b[0m ${name}`));
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
  console.error('\n\x1b[31mO roteiro parou:\x1b[0m', error);
  process.exit(1);
});
