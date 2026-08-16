process.env.FUNCTIONS_EMULATOR = 'true';
import assert from 'node:assert';
import { createPaymentCharge } from '../functions/src/payments.ts';
import { checkInfinitePayPayment } from '../functions/src/infinitePayGateway.ts';

console.log('\x1b[1mIniciando testes da integração InfinitePay (Backend / Functions)...\x1b[0m\n');

// 1. Criação de Cobrança PIX
console.log('1. Testando createPaymentCharge');
const chargeReq = {
  orderId: 'INS-20001',
  amount: 151.82,
  method: 'pix',
  customer: {
    name: 'Luiz Eduardo',
    email: 'luiz@example.com',
    cpf: '52998224725',
    phone: '61999998888',
  },
};

const chargeResult = await createPaymentCharge(chargeReq);
assert.strictEqual(chargeResult.gateway, 'infinitepay', 'Gateway deve ser infinitepay');
assert.strictEqual(chargeResult.providerRef, 'INS-20001', 'ProviderRef deve ser o ID do pedido');
assert.strictEqual(chargeResult.status, 'pendente', 'Status inicial deve ser pendente');
assert.strictEqual(typeof chargeResult.checkoutUrl, 'string', 'checkoutUrl deve ser uma string');
assert.strictEqual(chargeResult.checkoutUrl.includes('INS-20001'), true, 'checkoutUrl deve conter o orderId');
console.log(`   \x1b[32m✓\x1b[0m Cobrança criada com sucesso: ${chargeResult.checkoutUrl}\n`);

// 2. Validações de Segurança em createPaymentCharge
console.log('2. Testando recusa de requisições inválidas');
let errorThrown = false;
try {
  await createPaymentCharge({ ...chargeReq, method: 'cartao' });
} catch (e) {
  errorThrown = true;
  assert.strictEqual(e.message.includes('exclusivamente cobranças PIX'), true);
}
assert.strictEqual(errorThrown, true, 'Deve recusar método fora do PIX');

errorThrown = false;
try {
  await createPaymentCharge({ ...chargeReq, amount: -10 });
} catch (e) {
  errorThrown = true;
}
assert.strictEqual(errorThrown, true, 'Deve recusar valor negativo');

errorThrown = false;
try {
  await createPaymentCharge({ ...chargeReq, customer: { ...chargeReq.customer, cpf: '123' } });
} catch (e) {
  errorThrown = true;
}
assert.strictEqual(errorThrown, true, 'Deve recusar CPF inválido');
console.log('   \x1b[32m✓\x1b[0m Validações de segurança do backend aprovadas.\n');

// 3. Consulta de Pagamento e Emulador Proof
console.log('3. Testando verificação de pagamento simulada');
process.env.INFINITEPAY_EMULATOR_PAID_ORDERS = 'INS-20001:15182:pix';
const proofPaid = await checkInfinitePayPayment({
  orderId: 'INS-20001',
  transactionNsu: 'txn_12345',
  slug: 'slug_12345',
});
assert.strictEqual(proofPaid.paid, true, 'Pedido cadastrado no emulador deve retornar pago');
assert.strictEqual(proofPaid.amountCents, 15182, 'Centavos devem bater exatamente');
assert.strictEqual(proofPaid.captureMethod, 'pix', 'Método deve ser pix');

const proofUnpaid = await checkInfinitePayPayment({
  orderId: 'INS-99999',
  transactionNsu: 'txn_99999',
  slug: 'slug_99999',
});
assert.strictEqual(proofUnpaid.paid, false, 'Pedido não pago deve retornar paid: false');
console.log('   \x1b[32m✓\x1b[0m Consulta de pagamento e simulação validadas com sucesso.\n');

console.log('\x1b[32m\x1b[1mTodos os testes de fluxo InfinitePay passaram com 100% de sucesso!\x1b[0m');
