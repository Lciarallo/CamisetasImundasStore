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

  /* ---------------------------------------------------------------------- */
  section('Fechamento de pedido — o cliente não decide o preço');

  // Mesmo mandando preço, desconto e total forjados, o servidor ignora tudo.
  const forged = await call('placeOrder')({
    ...buyer,
    items: [{ productId: 'p-normal', size: 'M', quantity: 2, unitPrice: 1, price: 1 }],
    payment: { method: 'boleto' },
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
  check('desconto forjado é ignorado', order.discount === 0, `${order.discount}`);
  check('boleto entra como aguardando pagamento', order.status === 'aguardando-pagamento');
  check('número do pedido é sequencial', /^INS-\d+$/.test(order.id), order.id);

  const afterFirst = await getDoc(doc(db, 'products', 'p-normal'));
  check('estoque baixou 2 unidades', afterFirst.data()?.stock?.M === 3, `${afterFirst.data()?.stock?.M}`);

  /* --- PIX, cupom e frete ------------------------------------------------ */
  const pix = await call('placeOrder')({
    ...buyer,
    items: [{ productId: 'p-normal', size: 'P', quantity: 1 }],
    payment: { method: 'pix' },
    coupon: 'culto10',
  });
  // 149,90 − 10% = 134,91 + frete 24,90 = 159,81 − 5% PIX = 151,82
  check('cupom é aplicado em caixa-alta', pix.data.coupon === 'CULTO10');
  check('frete cobrado abaixo do teto', close(pix.data.shipping, 24.9));
  check('PIX com 5% e cupom de 10%', close(pix.data.total, 151.82), `${pix.data.total}`);

  const badCoupon = await call('placeOrder')({
    ...buyer,
    items: [{ productId: 'p-normal', size: 'P', quantity: 1 }],
    payment: { method: 'pix' },
    coupon: 'NAOEXISTE',
  });
  check('cupom inválido não derruba a compra', badCoupon.data.coupon === null);

  /* --- Cartão parcelado --------------------------------------------------- */
  const card6 = await call('placeOrder')({
    ...buyer,
    items: [{ productId: 'p-normal', size: 'G', quantity: 2 }],
    payment: { method: 'cartao', installments: 6, cardLast4: '4242', cardBrand: 'visa' },
  });
  check('6x sem juros mantém o total', close(card6.data.total, 299.8), `${card6.data.total}`);
  check('cartão aprova na hora', card6.data.status === 'pago');

  const card12 = await call('placeOrder')({
    ...buyer,
    items: [{ productId: 'p-normal', size: 'GG', quantity: 2 }],
    payment: { method: 'cartao', installments: 12, cardLast4: '4242', cardBrand: 'visa' },
  });
  check('12x cobra juros', card12.data.total > 299.8 + 10, `${card12.data.total}`);

  /* --- Limites ------------------------------------------------------------ */
  const overLine = await denied(
    call('placeOrder')({
      ...buyer,
      items: [{ productId: 'p-normal', size: 'M', quantity: 99 }],
      payment: { method: 'pix' },
    }),
  );
  check('quantidade acima do teto é recusada', overLine === 'functions/invalid-argument');

  const draftBuy = await denied(
    call('placeOrder')({
      ...buyer,
      items: [{ productId: 'p-rascunho', size: 'M', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check(
    'comprar peça fora do catálogo é recusado',
    draftBuy === 'functions/failed-precondition',
    `veio ${draftBuy}`,
  );

  const badSize = await denied(
    call('placeOrder')({
      ...buyer,
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
      customer: { ...buyer.customer, cpf: '111.111.111-11' },
      items: [{ productId: 'p-normal', size: 'M', quantity: 1 }],
      payment: { method: 'pix' },
    }),
  );
  check('CPF inválido é recusado', badCpf === 'functions/invalid-argument');

  /* --- Concorrência: última peça ------------------------------------------ */
  section('Estoque sob concorrência');

  const race = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      call('placeOrder')({
        ...buyer,
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

  const paidOrder = card6.data.id;
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
    'webhook sem segredo configurado recusa (503)',
    webhookNoSecret.status === 503,
    `veio ${webhookNoSecret.status}`,
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
