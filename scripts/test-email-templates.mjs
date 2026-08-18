import assert from 'node:assert/strict';
import {
  renderOrderCreatedEmail,
  renderPaymentApprovedEmail,
  renderInProductionEmail,
  renderOrderShippedEmail,
  renderOrderDeliveredEmail,
  renderOrderCancelledEmail,
} from '../functions/lib/emailTemplates.js';

console.log('Iniciando testes dos templates de e-mail transacionais...\n');

const mockOrder = {
  orderId: 'INS-20001',
  customerName: 'Luiz Eduardo',
  customerEmail: 'luiz@example.com',
  status: 'aguardando-pagamento',
  total: 151.82,
  subtotal: 159.81,
  discount: 7.99,
  shipping: 0,
  lines: [
    {
      name: 'Camiseta Bathory Goat',
      band: 'Bathory',
      size: 'G',
      quantity: 1,
      unitPrice: 159.81,
    },
  ],
  address: {
    street: 'Rua das Almas',
    number: '666',
    complement: 'Apto 13',
    district: 'Centro',
    city: 'Brasília',
    state: 'DF',
    cep: '70000-000',
  },
  checkoutUrl: 'https://checkout.infinitepay.io/luiz-eduardo-iqc?lenc=test',
  customerAccessToken: 'token-abc-123',
  trackingCode: 'BR123456789BR',
  storeUrl: 'https://camisetas-imundas-store.web.app',
};

// 1. Pedido Criado
const created = renderOrderCreatedEmail(mockOrder);
assert.ok(created.subject.includes('INS-20001'), 'Assunto deve conter orderId');
assert.ok(created.html.includes('Luiz Eduardo'), 'HTML deve conter nome');
assert.ok(created.html.includes('PAGAR AGORA COM PIX'), 'HTML deve conter CTA de pagamento');
console.log('1. Template Pedido Criado: OK (Assunto: ' + created.subject + ')');

// 2. Pagamento Confirmado
const paid = renderPaymentApprovedEmail(mockOrder);
assert.ok(paid.subject.includes('confirmado'), 'Assunto deve indicar confirmacao');
assert.ok(paid.html.includes('ACOMPANHAR MEU PEDIDO'), 'HTML deve conter link de acompanhamento');
console.log('2. Template Pagamento Confirmado: OK (Assunto: ' + paid.subject + ')');

// 3. Em Produção
const inProd = renderInProductionEmail(mockOrder);
assert.ok(inProd.subject.includes('prensa'), 'Assunto deve indicar producao');
assert.ok(inProd.html.includes('Em Produção Artesanal'), 'HTML deve conter status');
console.log('3. Template Em Produção: OK (Assunto: ' + inProd.subject + ')');

// 4. Pedido Enviado
const shipped = renderOrderShippedEmail(mockOrder);
assert.ok(shipped.subject.includes('caminho'), 'Assunto deve indicar envio');
assert.ok(shipped.html.includes('BR123456789BR'), 'HTML deve conter codigo de rastreio');
assert.ok(shipped.html.includes('RASTREAR NOS CORREIOS'), 'HTML deve conter link dos Correios');
console.log('4. Template Pedido Enviado: OK (Assunto: ' + shipped.subject + ')');

// 5. Pedido Entregue
const delivered = renderOrderDeliveredEmail(mockOrder);
assert.ok(delivered.subject.includes('Entregue'), 'Assunto deve indicar entrega');
assert.ok(delivered.html.includes('CULTO10'), 'HTML deve conter cupom de agradecimento');
console.log('5. Template Pedido Entregue: OK (Assunto: ' + delivered.subject + ')');

// 6. Pedido Cancelado
const cancelled = renderOrderCancelledEmail(mockOrder);
assert.ok(cancelled.subject.includes('cancelado'), 'Assunto deve indicar cancelamento');
assert.ok(cancelled.html.includes('30 minutos'), 'HTML deve explicar tempo limite');
console.log('6. Template Pedido Cancelado: OK (Assunto: ' + cancelled.subject + ')');

console.log('\nTodos os 6 templates de e-mail foram validados com 100% de sucesso!');
