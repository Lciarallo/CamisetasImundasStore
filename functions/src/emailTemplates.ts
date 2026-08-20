/**
 * Templates HTML de e-mails transacionais — Camisetas Imundas / Imundas.
 *
 * Estética Brutalista Dark: tipografia marcante, contrastes precisos,
 * botões de alta conversão e total compatibilidade com clientes de e-mail
 * (Gmail, Outlook, Apple Mail, iOS e Android).
 */

export interface EmailTemplateData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  lines: Array<{
    name: string;
    band?: string;
    size: string;
    quantity: number;
    unitPrice: number;
  }>;
  address?: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    cep: string;
  };
  checkoutUrl?: string | null;
  customerAccessToken?: string | null;
  trackingCode?: string | null;
  storeUrl?: string;
}

function money(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function baseLayout(title: string, preheader: string, content: string, storeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #0c0c0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    .btn { display: inline-block; padding: 14px 28px; background-color: #a5121b; color: #f3eee3 !important; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 2px; text-align: center; }
    .btn:hover { background-color: #c91823; }
    .btn-secondary { display: inline-block; padding: 12px 24px; background-color: #1f1f26; color: #e2ddd3 !important; text-decoration: none; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #33333d; border-radius: 2px; text-align: center; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0c0e; color: #e2ddd3;">
  <!-- Preheader invisível para preview na caixa de entrada -->
  <div style="display: none; font-size: 1px; color: #0c0c0e; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#0c0c0e">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #141418; border: 1px solid #23232b; border-radius: 4px; overflow: hidden;">
          <!-- Header com Marca -->
          <tr>
            <td style="padding: 24px 24px 20px 24px; background-color: #0d0d10; border-bottom: 2px solid #a5121b; text-align: center;">
              <img src="${storeUrl}/logo-white.png" alt="Camisetas Imundas" width="90" height="90" style="display: block; margin: 0 auto 10px auto; width: 90px; height: 90px; border: 0;" />
              <h1 style="margin: 0; font-family: 'Cinzel Decorative', Georgia, serif; font-size: 22px; letter-spacing: 0.15em; color: #f3eee3; text-transform: uppercase;">
                CAMISETAS IMUNDAS
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 10px; letter-spacing: 0.25em; color: #a5121b; text-transform: uppercase; font-weight: 700;">
                ACERVO BRUTALISTA DE UNDERGROUND
              </p>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding: 32px 24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #0d0d10; border-top: 1px solid #23232b; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #7a7782;">
                Dúvidas ou suporte? Responda a este e-mail ou acesse nosso site.
              </p>
              <p style="margin: 0; font-size: 11px;">
                <a href="${storeUrl}" style="color: #a5121b; text-decoration: none; font-weight: 600;">
                  Visitar Loja Oficial
                </a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 10px; color: #4e4c54;">
                © ${new Date().getFullYear()} Camisetas Imundas. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function itemsTable(lines: EmailTemplateData['lines'], subtotal?: number, discount?: number, shipping?: number, total?: number): string {
  const rows = lines
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #23232b;">
      <td style="padding: 12px 0; font-size: 13px; color: #f3eee3;">
        <strong style="color: #ffffff;">${item.name}</strong>
        ${item.band ? `<br><span style="font-size: 11px; color: #a5121b;">${item.band}</span>` : ''}
        <br><span style="font-size: 11px; color: #7a7782;">Tam: ${item.size} · Qtd: ${item.quantity}</span>
      </td>
      <td align="right" style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #f3eee3; white-space: nowrap;">
        ${money(item.unitPrice * item.quantity)}
      </td>
    </tr>`,
    )
    .join('');

  return `
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0; border-top: 1px solid #23232b;">
    ${rows}
    ${
      subtotal !== undefined
        ? `
    <tr>
      <td style="padding: 8px 0 4px 0; font-size: 12px; color: #7a7782;">Subtotal</td>
      <td align="right" style="padding: 8px 0 4px 0; font-size: 12px; color: #7a7782;">${money(subtotal)}</td>
    </tr>`
        : ''
    }
    ${
      discount && discount > 0
        ? `
    <tr>
      <td style="padding: 4px 0; font-size: 12px; color: #a5121b;">Desconto aplicado</td>
      <td align="right" style="padding: 4px 0; font-size: 12px; color: #a5121b;">−${money(discount)}</td>
    </tr>`
        : ''
    }
    ${
      shipping !== undefined
        ? `
    <tr>
      <td style="padding: 4px 0; font-size: 12px; color: #7a7782;">Frete</td>
      <td align="right" style="padding: 4px 0; font-size: 12px; color: #7a7782;">${shipping === 0 ? 'Grátis' : money(shipping)}</td>
    </tr>`
        : ''
    }
    ${
      total !== undefined
        ? `
    <tr style="border-top: 1px solid #33333d;">
      <td style="padding: 12px 0; font-size: 14px; font-weight: 700; color: #f3eee3; text-transform: uppercase;">Total</td>
      <td align="right" style="padding: 12px 0; font-size: 18px; font-weight: 800; color: #ffffff;">${money(total)}</td>
    </tr>`
        : ''
    }
  </table>`;
}

function addressBlock(address?: EmailTemplateData['address']): string {
  if (!address) return '';
  return `
  <div style="background-color: #0d0d10; border: 1px solid #23232b; padding: 16px; margin: 20px 0; border-radius: 2px;">
    <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a5121b; font-weight: 700;">
      Endereço de Entrega
    </p>
    <p style="margin: 0; font-size: 13px; color: #e2ddd3; line-height: 1.4;">
      ${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ''}<br>
      ${address.district} · ${address.city}/${address.state}<br>
      CEP: ${address.cep}
    </p>
  </div>`;
}

/* -------------------------------------------------------------------------- */
/* 1. Pedido Criado (Aguardando Pagamento)                                      */
/* -------------------------------------------------------------------------- */

export function renderOrderCreatedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';
  const payUrl = data.checkoutUrl || `${store}/#/checkout`;

  const content = `
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #ffffff; text-transform: uppercase; font-weight: 700;">
      Pedido Gerado com Sucesso
    </h2>
    <p style="margin: 0 0 20px 0; font-size: 13px; color: #9e9ba6; line-height: 1.5;">
      Salve, <strong style="color: #f3eee3;">${data.customerName}</strong>! Seu pedido <strong style="color: #ffffff;">${data.orderId}</strong> foi registrado em nosso acervo.
    </p>

    <div style="background-color: #1a0809; border: 1px solid #630c12; padding: 18px; text-align: center; margin: 24px 0; border-radius: 2px;">
      <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #ff5252; font-weight: 700;">
        Pagamento seguro via PIX
      </p>
      <p style="margin: 0 0 14px 0; font-size: 22px; font-weight: 800; color: #ffffff;">
        ${money(data.total)}
      </p>
      <a href="${payUrl}" class="btn" style="width: 80%;">
        PAGAR AGORA COM PIX
      </a>
      <p style="margin: 12px 0 0 0; font-size: 10px; color: #a89f9e;">
        A reserva das suas peças fica garantida por 30 minutos.
      </p>
    </div>

    <p style="margin: 20px 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f3eee3;">
      Itens Reservados
    </p>
    ${itemsTable(data.lines, data.subtotal, data.discount, data.shipping, data.total)}
    ${addressBlock(data.address)}
  `;

  return {
    subject: `Seu pedido ${data.orderId} foi gerado — Finalize com PIX`,
    html: baseLayout('Pedido Gerado — Camisetas Imundas', `Pedido ${data.orderId} gerado no valor de ${money(data.total)}. Finalize seu PIX para garantir sua peça.`, content, store),
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Pagamento Confirmado (Pedido Pago)                                       */
/* -------------------------------------------------------------------------- */

export function renderPaymentApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';
  const trackUrl = `${store}`;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: #0d2818; border: 1px solid #1b4d2e; border-radius: 20px; font-size: 11px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
        ✓ Pagamento Confirmado
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #ffffff; text-transform: uppercase; font-weight: 800;">
        Seu pedido está confirmado!
      </h2>
      <p style="margin: 0; font-size: 13px; color: #9e9ba6;">
        Pedido <strong style="color: #ffffff;">${data.orderId}</strong> pago no valor de <strong style="color: #ffffff;">${money(data.total)}</strong>.
      </p>
    </div>

    <p style="font-size: 13px; color: #e2ddd3; line-height: 1.5;">
      Salve, <strong style="color: #ffffff;">${data.customerName}</strong>! Identificamos o recebimento do seu PIX com sucesso. Nossas peças já foram reservadas e estão entrando na esteira de separação e embalagem.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${trackUrl}" class="btn">
        ACOMPANHAR MEU PEDIDO
      </a>
      ${
        data.customerAccessToken
          ? `<p style="margin: 10px 0 0 0; font-size: 11px; color: #7a7782;">
              Código de Acesso do Pedido: <strong style="color: #f3eee3; font-family: monospace;">${data.customerAccessToken}</strong>
            </p>`
          : ''
      }
    </div>

    <div style="background-color: #0d1f14; border: 1px solid #1c4a2a; padding: 14px 18px; margin: 20px 0; border-radius: 2px;">
      <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4ade80; font-weight: 700;">
        📄 Nota Fiscal Eletrônica (DANFE)
      </p>
      <p style="margin: 0; font-size: 12px; color: #d1fae5; line-height: 1.4;">
        Sua NF-e foi emitida com sucesso e vinculada ao pagamento. Você pode visualizá-la e imprimi-la a qualquer momento na Área do Cliente informando seu pedido.
      </p>
    </div>

    <p style="margin: 20px 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f3eee3;">
      Resumo da Compra
    </p>
    ${itemsTable(data.lines, data.subtotal, data.discount, data.shipping, data.total)}
    ${addressBlock(data.address)}
  `;

  return {
    subject: `Pagamento confirmado: pedido ${data.orderId} em separação!`,
    html: baseLayout('Pagamento Confirmado — Camisetas Imundas', `Seu pagamento para o pedido ${data.orderId} foi confirmado com sucesso. Suas peças já estão em separação.`, content, store),
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Em Produção (Confecção / Estamparia)                                     */
/* -------------------------------------------------------------------------- */

export function renderInProductionEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: #2b1807; border: 1px solid #57310e; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fb923c; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
        ⚙ Em Produção Artesanal
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #ffffff; text-transform: uppercase; font-weight: 800;">
        Sua estampa está na prensa!
      </h2>
      <p style="margin: 0; font-size: 13px; color: #9e9ba6;">
        Pedido <strong style="color: #ffffff;">${data.orderId}</strong>
      </p>
    </div>

    <p style="font-size: 13px; color: #e2ddd3; line-height: 1.5;">
      Fala, <strong style="color: #ffffff;">${data.customerName}</strong>! Suas peças entraram em processo de confecção e estamparia artesanal na nossa oficina. Cada manto é prensado com tinta de alta densidade e acabamento reforçado.
    </p>

    <div style="background-color: #0d0d10; border: 1px solid #23232b; padding: 18px; margin: 24px 0; border-radius: 2px;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #f3eee3; text-transform: uppercase;">
        Próxima Etapa:
      </p>
      <p style="margin: 0; font-size: 12px; color: #9e9ba6; line-height: 1.4;">
        Assim que a cura da tinta for concluída e a embalagem for lacrada, você receberá um e-mail com o <strong>código de rastreio dos Correios</strong>.
      </p>
    </div>

    <p style="margin: 20px 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f3eee3;">
      Peças em Produção
    </p>
    ${itemsTable(data.lines)}
  `;

  return {
    subject: `Sua estampa está na prensa! Pedido ${data.orderId}`,
    html: baseLayout('Em Produção — Camisetas Imundas', `O pedido ${data.orderId} entrou na esteira de produção artesanal.`, content, store),
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Pedido Enviado (Despachado / Rastreamento)                              */
/* -------------------------------------------------------------------------- */

export function renderOrderShippedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';
  const trackCode = data.trackingCode || '';
  const correiosUrl = trackCode
    ? `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(trackCode)}`
    : store;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: #1a0809; border: 1px solid #a5121b; border-radius: 20px; font-size: 11px; font-weight: 700; color: #ff5252; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
        🚚 Pedido Despachado
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #ffffff; text-transform: uppercase; font-weight: 800;">
        Seu manto está a caminho!
      </h2>
      <p style="margin: 0; font-size: 13px; color: #9e9ba6;">
        Pedido <strong style="color: #ffffff;">${data.orderId}</strong>
      </p>
    </div>

    <p style="font-size: 13px; color: #e2ddd3; line-height: 1.5;">
      Salve, <strong style="color: #ffffff;">${data.customerName}</strong>! Seu pacote foi cuidadosamente embalado e despachado nos Correios.
    </p>

    ${
      trackCode
        ? `
    <div style="background-color: #0d0d10; border: 1px solid #33333d; padding: 20px; text-align: center; margin: 24px 0; border-radius: 2px;">
      <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a5121b; font-weight: 700;">
        Código de Rastreamento
      </p>
      <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; font-family: monospace; color: #ffffff; letter-spacing: 0.1em;">
        ${trackCode}
      </p>
      <a href="${correiosUrl}" class="btn" style="width: 80%;">
        RASTREAR NOS CORREIOS
      </a>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #7a7782;">
        O rastreio pode levar até 24h para atualizar no sistema dos Correios.
      </p>
    </div>`
        : ''
    }

    ${addressBlock(data.address)}
    <p style="margin: 20px 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f3eee3;">
      Itens no Pacote
    </p>
    ${itemsTable(data.lines)}
  `;

  return {
    subject: `Seu manto está a caminho! Rastreio ${data.orderId}`,
    html: baseLayout('Pedido Enviado — Camisetas Imundas', `Seu pedido ${data.orderId} foi postado nos Correios. Código de rastreio: ${trackCode || 'Disponível no site'}.`, content, store),
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Pedido Entregue                                                         */
/* -------------------------------------------------------------------------- */

export function renderOrderDeliveredEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: #0d2818; border: 1px solid #1b4d2e; border-radius: 20px; font-size: 11px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
        ★ Pacote Entregue
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #ffffff; text-transform: uppercase; font-weight: 800;">
        Seu manto chegou ao destino!
      </h2>
      <p style="margin: 0; font-size: 13px; color: #9e9ba6;">
        Pedido <strong style="color: #ffffff;">${data.orderId}</strong>
      </p>
    </div>

    <p style="font-size: 13px; color: #e2ddd3; line-height: 1.5;">
      Salve, <strong style="color: #ffffff;">${data.customerName}</strong>! Consta no sistema dos Correios que o seu pacote foi entregue com sucesso.
    </p>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${store}" class="btn">CONFERIR NOVO ACERVO</a>
    </div>

    <p style="font-size: 12px; color: #7a7782; text-align: center; margin-top: 20px;">
      Gostou da peça? Marque a gente nas redes com o seu manto!
    </p>
  `;

  return {
    subject: `Entregue! Seu manto ${data.orderId} chegou ao destino`,
    html: baseLayout('Pedido Entregue — Camisetas Imundas', `Seu pedido ${data.orderId} foi entregue com sucesso. Aproveite seu manto!`, content, store),
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Pedido Cancelado                                                        */
/* -------------------------------------------------------------------------- */

export function renderOrderCancelledEmail(data: EmailTemplateData): { subject: string; html: string } {
  const store = data.storeUrl || 'https://camisetas-imundas-store.web.app';

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: #1f1f26; border: 1px solid #33333d; border-radius: 20px; font-size: 11px; font-weight: 700; color: #9e9ba6; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
        ✕ Pedido Cancelado
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #ffffff; text-transform: uppercase; font-weight: 700;">
        Reserva expirada para o pedido ${data.orderId}
      </h2>
    </div>

    <p style="font-size: 13px; color: #e2ddd3; line-height: 1.5;">
      Olá, <strong style="color: #ffffff;">${data.customerName}</strong>. O tempo limite de 30 minutos para confirmação do pagamento PIX do pedido <strong>${data.orderId}</strong> expirou e as peças foram devolvidas ao estoque da loja.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${store}" class="btn">
        REFAZER MEU PEDIDO NA LOJA
      </a>
    </div>

    <p style="margin: 20px 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #f3eee3;">
      Itens que estavam no pedido:
    </p>
    ${itemsTable(data.lines)}
  `;

  return {
    subject: `Pedido ${data.orderId} cancelado por tempo de reserva`,
    html: baseLayout('Pedido Cancelado — Camisetas Imundas', `A reserva do pedido ${data.orderId} expirou. As peças voltaram para o estoque.`, content, store),
  };
}
