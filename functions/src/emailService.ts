/**
 * Serviço de envio de e-mails transacionais via Resend.
 *
 * Integra com Secret Manager (RESEND_API_KEY) e registra os envios no
 * histórico do pedido para rastreabilidade operacional.
 */
import { Resend } from 'resend';
import { logger } from 'firebase-functions';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  renderOrderCreatedEmail,
  renderPaymentApprovedEmail,
  renderInProductionEmail,
  renderOrderShippedEmail,
  renderOrderDeliveredEmail,
  renderOrderCancelledEmail,
  type EmailTemplateData,
} from './emailTemplates.js';

export const RESEND_SECRETS = ['RESEND_API_KEY'] as const;

export type EmailEventType =
  | 'pedido-criado'
  | 'pagamento-confirmado'
  | 'em-producao'
  | 'pedido-enviado'
  | 'pedido-entregue'
  | 'pedido-cancelado';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getSender(): string {
  return (
    process.env.EMAIL_FROM ||
    'Camisetas Imundas <onboarding@resend.dev>'
  );
}

/**
 * Envia o e-mail transacional correspondente à etapa do pedido.
 */
export async function sendOrderStatusEmail(
  order: Record<string, any>,
  event: EmailEventType,
): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  const customer = order.customer ?? {};
  const customerEmail = customer.email;

  if (!customerEmail || typeof customerEmail !== 'string') {
    logger.warn('Pedido sem e-mail do cliente, pulando notificação', { orderId: order.id, event });
    return { sent: false, reason: 'missing-customer-email' };
  }

  const templateData: EmailTemplateData = {
    orderId: order.id,
    customerName: customer.name || 'Cliente',
    customerEmail,
    status: order.status,
    total: order.total ?? 0,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    lines: (order.lines ?? []).map((l: any) => ({
      name: l.name,
      band: l.band,
      size: l.size,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    address: order.address,
    checkoutUrl: order.payment?.checkoutUrl,
    customerAccessToken: order.customerAccessToken,
    trackingCode: order.trackingCode,
    storeUrl: process.env.STORE_PUBLIC_URL || 'https://camisetas-imundas-store.web.app',
  };

  let rendered: { subject: string; html: string };

  switch (event) {
    case 'pedido-criado':
      rendered = renderOrderCreatedEmail(templateData);
      break;
    case 'pagamento-confirmado':
      rendered = renderPaymentApprovedEmail(templateData);
      break;
    case 'em-producao':
      rendered = renderInProductionEmail(templateData);
      break;
    case 'pedido-enviado':
      rendered = renderOrderShippedEmail(templateData);
      break;
    case 'pedido-entregue':
      rendered = renderOrderDeliveredEmail(templateData);
      break;
    case 'pedido-cancelado':
      rendered = renderOrderCancelledEmail(templateData);
      break;
    default:
      logger.warn('Evento de e-mail não reconhecido', { event, orderId: order.id });
      return { sent: false, reason: 'unknown-event' };
  }

  const resend = getResendClient();

  if (!resend) {
    logger.info('Simulação de envio de e-mail (RESEND_API_KEY não configurada no Secret Manager)', {
      orderId: order.id,
      event,
      to: customerEmail,
      subject: rendered.subject,
    });
    return { sent: false, reason: 'resend-not-configured-logged-only' };
  }

  try {
    const sender = getSender();
    // Se estiver usando o domínio de teste padrão do Resend sem domínio próprio
    const fromAddress = sender.includes('@') ? sender : 'onboarding@resend.dev';

    const result = await resend.emails.send({
      from: fromAddress,
      to: customerEmail,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (result.error) {
      logger.error('Erro ao disparar e-mail via Resend', {
        error: result.error,
        orderId: order.id,
        event,
      });
      return { sent: false, reason: result.error.message };
    }

    const messageId = result.data?.id;
    logger.info('E-mail transacional enviado com sucesso via Resend', {
      orderId: order.id,
      event,
      to: customerEmail,
      messageId,
    });

    // Grava no histórico de envios do pedido
    try {
      const db = getFirestore();
      await db.collection('orders').doc(order.id).update({
        emailsSent: FieldValue.arrayUnion({
          event,
          to: customerEmail,
          subject: rendered.subject,
          at: new Date().toISOString(),
          messageId,
        }),
      });
    } catch {
      // Falha não crítica de log no doc
    }

    return { sent: true, messageId };
  } catch (cause) {
    logger.error('Exceção ao enviar e-mail', {
      error: (cause as Error).message,
      orderId: order.id,
      event,
    });
    return { sent: false, reason: (cause as Error).message };
  }
}
