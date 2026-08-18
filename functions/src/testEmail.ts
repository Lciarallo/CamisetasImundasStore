import { Resend } from 'resend';
import { renderOrderCreatedEmail } from './emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY || '');

const mockOrder = {
  orderId: 'INS-20001',
  customerName: 'Luiz Eduardo Ciarallo',
  customerEmail: 'luizeduardociarallo@gmail.com',
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
  customerAccessToken: 'token-teste-insanas',
  trackingCode: 'BR123456789BR',
  storeUrl: 'https://camisetas-imundas-store.web.app',
};

console.log('Renderizando template do pedido...');
const emailData = renderOrderCreatedEmail(mockOrder);

console.log(`Disparando e-mail de teste para brdtbrasil@gmail.com...`);
const result = await resend.emails.send({
  from: 'Camisetas Imundas <onboarding@resend.dev>',
  to: 'brdtbrasil@gmail.com',
  subject: emailData.subject,
  html: emailData.html,
});

console.log('Resultado do envio:', JSON.stringify(result, null, 2));
if (result.error) {
  console.error('Erro Resend:', result.error);
} else {
  console.log('\n✓ E-mail enviado com sucesso para luizeduardociarallo@gmail.com!');
  console.log('Message ID:', result.data?.id);
}
