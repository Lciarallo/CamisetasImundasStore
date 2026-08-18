import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'camisetas-imundas-store' });
}

const db = getFirestore();

console.log('Iniciando limpeza dos dados de teste no Firestore...');

// 1. Apaga todos os pedidos de teste
const ordersSnap = await db.collection('orders').get();
console.log(`Encontrados ${ordersSnap.size} pedidos para apagar.`);
for (const doc of ordersSnap.docs) {
  await doc.ref.delete();
  console.log(`- Apagado pedido: ${doc.id}`);
}

// 2. Apaga todos os eventos de pagamento
const eventsSnap = await db.collection('paymentEvents').get();
console.log(`Encontrados ${eventsSnap.size} eventos de pagamento para apagar.`);
for (const doc of eventsSnap.docs) {
  await doc.ref.delete();
  console.log(`- Apagado evento: ${doc.id}`);
}

// 3. Apaga pagamentos não conciliados
const unrecSnap = await db.collection('unreconciledPayments').get();
console.log(`Encontrados ${unrecSnap.size} pagamentos não conciliados para apagar.`);
for (const doc of unrecSnap.docs) {
  await doc.ref.delete();
}

// 4. Apaga tentativas idempotentes
const reqsSnap = await db.collection('orderRequests').get();
console.log(`Encontrados ${reqsSnap.size} registros idempotentes para apagar.`);
for (const doc of reqsSnap.docs) {
  await doc.ref.delete();
}

// 5. Reseta o contador para 20000
await db.collection('counters').doc('orderNumber').set({ value: 20000 }, { merge: true });
console.log('Contador de pedidos resetado para 20000 (próximo pedido será INS-20001).');

// 6. Restaura os estoques padrão
const productsSnap = await db.collection('products').get();
console.log(`Restaurando estoque de ${productsSnap.size} produtos...`);
for (const doc of productsSnap.docs) {
  const data = doc.data();
  if (data.stock) {
    const updatedStock = {
      P: 10,
      M: 15,
      G: 15,
      GG: 8,
      XGG: 5,
    };
    await doc.ref.update({ stock: updatedStock });
  }
}

console.log('\nLimpeza de histórico concluída com sucesso!');
