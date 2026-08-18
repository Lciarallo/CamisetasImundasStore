/**
 * Adds the Conqueror product to Firestore using the Firebase CLI's refresh token.
 * This avoids needing a service account key.
 */
const fs = await import('node:fs');
const https = await import('node:https');
const path = await import('node:path');

const configPath = path.join(
  process.env.HOME,
  '.config/configstore/firebase-tools.json',
);
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const refreshToken = config.tokens.refresh_token;
const clientId = config.tokens.client_id || '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const clientSecret = config.tokens.client_secret || 'j9iVZfS8kkCEFUPaAeJV0sAi';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', (chunk) => (buf += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${buf}`));
        else resolve(JSON.parse(buf));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function patch(url, body, accessToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        Authorization: `Bearer ${accessToken}`,
      },
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', (chunk) => (buf += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${buf}`));
        else resolve(JSON.parse(buf));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Exchange refresh token for access token
  const tokenRes = await post(
    'https://oauth2.googleapis.com/token',
    `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
  ).catch((e) => {
    // retry with form-urlencoded content-type
    return new Promise((resolve, reject) => {
      const data = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
      const opts = {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
      };
      const req = https.request(opts, (res) => {
        let buf = '';
        res.on('data', (chunk) => (buf += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${buf}`));
          else resolve(JSON.parse(buf));
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  });

  const accessToken = tokenRes.access_token;
  console.log('✅ Access token obtained');

  // 2. Create the product document via Firestore REST API
  const projectId = 'camisetas-imundas-store';
  const docId = 'p-113';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${docId}`;

  const firestoreDoc = {
    fields: {
      name: { stringValue: 'Conqueror — War.Cult.Supremacy' },
      band: { stringValue: 'Conqueror' },
      category: { stringValue: 'Camiseta' },
      price: { doubleValue: 67.9 },
      oldPrice: { integerValue: '80' },
      art: {
        mapValue: {
          fields: {
            sigil: { stringValue: 'skull' },
            tone: { stringValue: 'blood' },
            fabric: { stringValue: 'preto' },
          },
        },
      },
      photos: {
        arrayValue: {
          values: [
            { stringValue: '/products/conqueror/conqueror-front.webp' },
            { stringValue: '/products/conqueror/conqueror-back.webp' },
            { stringValue: '/products/conqueror/conqueror-pair.webp' },
          ],
        },
      },
      tag: { stringValue: 'Lançamento' },
      rating: { integerValue: '5' },
      reviewsCount: { integerValue: '0' },
      description: {
        stringValue:
          'Estampa definitiva do manifesto do war metal canadense "War.Cult.Supremacy" — logotipo envolto em arame farpado e crânio na frente, acompanhado do guerreiro alado mascarado armado de metralhadora nas costas. Confeccionada em algodão vermelho sangue de alta gramatura.',
      },
      details: {
        arrayValue: {
          values: [
            { stringValue: 'Algodão 100% penteado 190g/m² vermelho sangue' },
            { stringValue: 'Serigrafia em branco e preto de alto contraste, frente e costas' },
            { stringValue: 'Estampa de alta definição e durabilidade' },
            { stringValue: 'Produzida sob encomenda após a compra' },
          ],
        },
      },
      fulfillment: { stringValue: 'sob-encomenda' },
      stock: { mapValue: { fields: {} } },
      madeToOrderSizes: {
        arrayValue: {
          values: [
            { stringValue: 'P' },
            { stringValue: 'M' },
            { stringValue: 'G' },
            { stringValue: 'GG' },
            { stringValue: 'XGG' },
          ],
        },
      },
      productionDays: { integerValue: '15' },
      lowStockThreshold: { integerValue: '0' },
      active: { booleanValue: true },
      createdAt: { stringValue: '2026-08-18T10:50:00.000Z' },
    },
  };

  await patch(url, firestoreDoc, accessToken);
  console.log('✅ Conqueror — War.Cult.Supremacy adicionado ao Firestore (p-113)');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
