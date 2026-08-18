import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'camisetas-imundas-store.firebaseapp.com',
  projectId: 'camisetas-imundas-store',
  storageBucket: 'camisetas-imundas-store.firebasestorage.app',
  messagingSenderId: '692693427304',
  appId: '1:692693427304:web:65e1ebca577eece1060934',
};

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const match = content.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (match) firebaseConfig.apiKey = match[1].trim();
}

const CROPS = '/tmp/tee-crops';

const PRODUCTS = [
  {
    id: 'p-101',
    name: 'Mütiilation — Satanist Styrken',
    band: 'Mütiilation',
    category: 'Camiseta',
    price: 149.9,
    art: { sigil: 'skull', tone: 'bone', fabric: 'off-white' },
    photoFiles: ['mutilator-front.jpg'],
    tag: 'Reissue',
    rating: 5,
    reviewsCount: 0,
    description:
      'Estampa clássica do tape "Satanist Styrken" — colagem de jornal e retrato encapuzado, como manda o culto oitentista. Impressão em algodão branco, peça só de frente.',
    details: [
      'Algodão 100% penteado 180g/m²',
      'Serigrafia preta de alto contraste, só na frente',
      'Estampa de alta definição e durabilidade',
      'Produzida sob encomenda após a compra',
    ],
    fulfillment: 'sob-encomenda',
    stock: {},
    madeToOrderSizes: ['P', 'M', 'G', 'GG', 'XGG'],
    productionDays: 10,
    lowStockThreshold: 0,
    active: true,
  },
  {
    id: 'p-102',
    name: 'Emperor — Wrath of the Tyrant',
    band: 'Emperor',
    category: 'Camiseta',
    price: 179.9,
    art: { sigil: 'heptagram', tone: 'bone', fabric: 'preto' },
    photoFiles: ['emperor-front.jpg', 'emperor-back.jpg'],
    tag: 'Reissue',
    rating: 5,
    reviewsCount: 0,
    description:
      'Estampa com a arte de "Wrath of the Tyrant" na frente e o brasão heráldico completo nas costas. Traço fino em branco sobre preto.',
    details: [
      'Algodão 100% penteado 190g/m²',
      'Serigrafia branca de traço fino, frente e costas',
      'Estampa de alta definição e durabilidade',
      'Produzida sob encomenda após a compra',
    ],
    fulfillment: 'sob-encomenda',
    stock: {},
    madeToOrderSizes: ['P', 'M', 'G', 'GG', 'XGG'],
    productionDays: 15,
    lowStockThreshold: 0,
    active: true,
  },
  {
    id: 'p-103',
    name: 'Blasphemy — Fallen Angel of Doom',
    band: 'Blasphemy',
    category: 'Camiseta',
    price: 169.9,
    art: { sigil: 'pentagram', tone: 'blood', fabric: 'preto' },
    photoFiles: ['blasphemy-front.jpg', 'blasphemy-back.jpg'],
    tag: 'Reissue',
    rating: 5,
    reviewsCount: 0,
    description:
      'Estampa da capa do álbum de estreia: o arqueiro alado na frente, o demônio vermelho e a letra completa nas costas. Vermelho sangue sobre preto, sem meio-tom.',
    details: [
      'Algodão 100% penteado 185g/m²',
      'Serigrafia em vermelho e branco, frente e costas',
      'Estampa de alta definição e durabilidade',
      'Produzida sob encomenda após a compra',
    ],
    fulfillment: 'sob-encomenda',
    stock: {},
    madeToOrderSizes: ['P', 'M', 'G', 'GG', 'XGG'],
    productionDays: 12,
    lowStockThreshold: 0,
    active: true,
  },
  {
    id: 'p-104',
    name: 'Summoning — Let Mortal Heroes Sing Your Fame',
    band: 'Summoning',
    category: 'Camiseta',
    price: 189.9,
    art: { sigil: 'moon', tone: 'bone', fabric: 'preto' },
    photoFiles: ['summoning-front.jpg', 'summoning-back.jpg'],
    tag: 'Reissue',
    rating: 5,
    reviewsCount: 0,
    description:
      'Estampa da arte do álbum: sigilo e paisagem em laranja queimado na frente, anel com escrita élfica gravado nas costas. Para quem leva o épico a sério.',
    details: [
      'Algodão 100% penteado 185g/m²',
      'Serigrafia em laranja sobre preto, frente e costas',
      'Estampa de alta definição e durabilidade',
      'Produzida sob encomenda após a compra',
    ],
    fulfillment: 'sob-encomenda',
    stock: {},
    madeToOrderSizes: ['P', 'M', 'G', 'GG', 'XGG'],
    productionDays: 18,
    lowStockThreshold: 0,
    active: true,
  },
  {
    id: 'p-105',
    name: 'Phyllomedusa — Death Is No Laughing Matter',
    band: 'Phyllomedusa',
    category: 'Camiseta',
    price: 154.9,
    art: { sigil: 'eye', tone: 'bone', fabric: 'preto' },
    photoFiles: ['anfibia-front.jpg', 'anfibia-back.jpg'],
    tag: 'Lançamento',
    rating: 5,
    reviewsCount: 0,
    description:
      'Estampa em homenagem ao clássico "Death Is No Laughing Matter" do Phyllomedusa em pictogramas — sapos e larvas compondo a arte na frente e "I hate what\'s on the other side" nas costas.',
    details: [
      'Algodão 100% penteado 180g/m²',
      'Serigrafia branca de alto contraste, frente e costas',
      'Peça autoral, tiragem sob encomenda',
      'Produzida sob encomenda após a compra',
    ],
    fulfillment: 'sob-encomenda',
    stock: {},
    madeToOrderSizes: ['P', 'M', 'G', 'GG', 'XGG'],
    productionDays: 14,
    lowStockThreshold: 0,
    active: true,
  },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const bucket = getStorage(app);
  const fns = getFunctions(app, 'southamerica-east1');

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar.');
  }

  console.log('Autenticando como admin no Firebase...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Logado como: ${cred.user.email} (${cred.user.uid})`);

  const existing = await getDocs(collection(db, 'products'));
  console.log(`\nProdutos atualmente no catálogo: ${existing.size}`);
  existing.docs.forEach((d) => console.log(`  - ${d.id}: ${d.data().name}`));

  console.log('\nEnviando fotos para o Cloud Storage...');
  const now = new Date().toISOString();
  const seedEntries = [];

  for (const p of PRODUCTS) {
    const photos = [];
    for (const file of p.photoFiles) {
      const bytes = fs.readFileSync(`${CROPS}/${file}`);
      const dest = storageRef(bucket, `products/${p.id}/${file}`);
      await uploadBytes(dest, bytes, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(dest);
      photos.push(url);
      console.log(`  ✓ ${p.id}/${file}`);
    }

    const { photoFiles, ...rest } = p;
    seedEntries.push({
      id: p.id,
      product: { ...rest, photos, createdAt: now },
    });
  }

  console.log('\nSubstituindo o catálogo (seedCatalog replace:true)...');
  const seedCatalog = httpsCallable(fns, 'seedCatalog');
  const result = await seedCatalog({ products: seedEntries, replace: true });
  console.log('Resultado:', result.data);

  console.log('\nCatálogo substituído com sucesso.');
  process.exit(0);
}

main().catch((error) => {
  console.error('\nFalhou:', error);
  process.exit(1);
});
