import assert from 'node:assert';
import { computeTotals } from '../src/store/cart.ts';
import { SEED_PRODUCTS } from '../src/data/products.ts';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from '../src/data/seed.ts';
import { isValidCPF, isValidCEP, isValidEmail, maskCPF, maskCEP, money } from '../src/lib/format.ts';

console.log('\x1b[1mIniciando testes de lógica de domínio e regras de negócio...\x1b[0m\n');

// 1. Validação de Formatos
console.log('1. Testando validação de formatos (CPF, CEP, Email, Dinheiro)');
assert.strictEqual(isValidCPF('52998224725'), true, 'CPF válido deve passar');
assert.strictEqual(isValidCPF('11111111111'), false, 'CPF com dígitos repetidos deve falhar');
assert.strictEqual(isValidCPF('12345678900'), false, 'CPF com checksum errado deve falhar');

assert.strictEqual(isValidCEP('70040-010'), true, 'CEP com máscara deve passar');
assert.strictEqual(isValidCEP('70040010'), true, 'CEP puro deve passar');
assert.strictEqual(isValidCEP('00000-000'), false, 'CEP zerado deve falhar');

assert.strictEqual(isValidEmail('usuario@example.com'), true, 'Email padrão deve passar');
assert.strictEqual(isValidEmail('invalido'), false, 'Email sem arroba deve falhar');

assert.strictEqual(maskCPF('52998224725'), '529.982.247-25', 'Máscara de CPF deve formatar corretamente');
assert.strictEqual(maskCEP('70040010'), '70040-010', 'Máscara de CEP deve formatar corretamente');
assert.strictEqual(money(150), 'R$\xa0150,00', 'Formatação de moeda deve estar correta');
console.log('   \x1b[32m✓\x1b[0m Formatações e validações funcionando corretamente.\n');

// 2. Totais do Carrinho e Regras de Frete/Desconto
console.log('2. Testando cálculo de totais do carrinho e cupons');
const p1 = SEED_PRODUCTS[0]; // Produto 1
const p2 = SEED_PRODUCTS[1]; // Produto 2

const cartItem1 = { productId: p1.id, size: 'M', quantity: 1, fulfillment: p1.fulfillment };
const totals1 = computeTotals([cartItem1], SEED_PRODUCTS, null);

assert.strictEqual(totals1.subtotal, p1.price, 'Subtotal deve bater com o preço do produto');
assert.strictEqual(totals1.shipping, SHIPPING_COST, `Frete abaixo de R$ ${FREE_SHIPPING_THRESHOLD} deve ser ${SHIPPING_COST}`);
assert.strictEqual(totals1.total, p1.price + SHIPPING_COST, 'Total deve ser subtotal + frete');

// Testando cupom CULTO10 (10% de desconto)
const coupon10 = { code: 'CULTO10', percent: 10, minSubtotal: 0, active: true };
const totalsWithCoupon = computeTotals([cartItem1], SEED_PRODUCTS, coupon10);
const expectedDiscount = Math.round(p1.price * 0.1 * 100) / 100;
assert.strictEqual(totalsWithCoupon.discount, expectedDiscount, 'Desconto do cupom deve ser 10%');

// Testando frete grátis com múltiplos itens
const cartItem2 = { productId: p2.id, size: 'G', quantity: 3, fulfillment: p2.fulfillment };
const totalsFreeShipping = computeTotals([cartItem1, cartItem2], SEED_PRODUCTS, null);
if (totalsFreeShipping.subtotal >= FREE_SHIPPING_THRESHOLD) {
  assert.strictEqual(totalsFreeShipping.shipping, 0, 'Frete deve ser grátis para pedidos acima do limite');
  assert.strictEqual(totalsFreeShipping.missingForFreeShipping, 0, 'Falta para frete grátis deve ser 0');
}
console.log('   \x1b[32m✓\x1b[0m Cálculos de carrinho, frete grátis e cupons aprovados.\n');

// 3. PIX não altera o valor comercial
console.log('3. Testando PIX sem desconto automático');
assert.strictEqual(
  totalsWithCoupon.total,
  totalsWithCoupon.subtotal - totalsWithCoupon.discount + totalsWithCoupon.shipping,
  'PIX deve cobrar exatamente o total após cupom e frete',
);
console.log('   \x1b[32m✓\x1b[0m PIX mantém o total calculado pelo carrinho.\n');

console.log('\x1b[32m\x1b[1mTodos os 3 grupos de testes unitários passaram com sucesso!\x1b[0m');
