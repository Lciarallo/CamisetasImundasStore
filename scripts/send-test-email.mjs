import { Resend } from 'resend';
import {
  renderOrderCreatedEmail,
  renderPaymentApprovedEmail,
} from '../functions/lib/emailTemplates.js';

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

console.log(`Disparando e-mail de teste para ${mockOrder.customerEmail}...`);
const result = await resend.emails.send({
  from: 'Camisetas Imundas <onboarding@resend.dev>',
  to: 'luizeduardociarallo@gmail.com',
  subject: emailData.subject,
  html: emailData.html,
});

console.log('Resultado do envio:', result);
if (result.error) {
  console.error('Erro Resend:', result.error);
} else {
  console.log('E-mail enviado com sucesso! Message ID:', result.data.id);
}
