const axios = require('axios');

const normalizePhone = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = `254${cleaned.slice(1)}`;
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = `254${cleaned}`;
  return cleaned;
};

const formatKES = (amount) => {
  const value = Number(amount) || 0;
  return `KSh ${Math.round(value).toLocaleString('en-KE')}`;
};

const isConfigured = (value) => {
  const normalized = String(value || '').trim();
  return normalized !== '' && !/^(your_|replace[-_]?me|change[-_]?me)/i.test(normalized);
};

const buildOrderMessage = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items
    .slice(0, 8)
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(', ');
      return `- ${item.name} x${item.quantity}${variant ? ` (${variant})` : ''}`;
    })
    .join('\n');

  return [
    'New Paulah Styles order',
    '',
    `Tracking: ${order.tracking_number || order.id}`,
    `Customer: ${order.full_name}`,
    `Phone: ${order.phone}`,
    `Location: ${[order.street, order.city, order.county].filter(Boolean).join(', ')}`,
    `Payment: ${order.payment_method} (${order.payment_status})`,
    `Total: ${formatKES(order.total_price)}`,
    `Due on delivery: ${formatKES(order.balance_due)}`,
    order.delivery_notes ? `Notes: ${order.delivery_notes}` : '',
    '',
    itemLines ? `Items:\n${itemLines}` : '',
    items.length > 8 ? `...and ${items.length - 8} more item(s)` : '',
  ].filter(Boolean).join('\n');
};

const buildOrderTemplate = (order, parameterLimit = 6) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemSummary = items.length
    ? items.slice(0, 8).map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(', ');
      return `${item.name} x${item.quantity}${variant ? ` (${variant})` : ''}`;
    }).join('; ')
    : 'No item details';
  const orderDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  }).format(order.created_at ? new Date(order.created_at) : new Date());
  const groupedParameters = [
    `Customer: ${order.full_name || 'Not provided'} | Phone: ${order.phone || 'Not provided'}`,
    `Tracking: ${order.tracking_number || order.id} | Date: ${orderDate} | Items: ${itemSummary}${items.length > 8 ? `; and ${items.length - 8} more` : ''} | Total: ${formatKES(order.total_price)} | Payment: ${order.payment_method || 'Not provided'} (${order.payment_status || 'Pending'})`,
    `Delivery: ${[order.street, order.city, order.county, order.country].filter(Boolean).join(', ') || 'Not provided'} | Due on delivery: ${formatKES(order.balance_due)} | Notes: ${order.delivery_notes || 'None'}`,
  ];
  const parameters = parameterLimit === 3
    ? groupedParameters
    : [
        order.full_name || 'Customer',
        order.tracking_number || String(order.id),
        orderDate,
        order.phone || 'Not provided',
        [order.street, order.city, order.county, order.country].filter(Boolean).join(', ') || 'Not provided',
        order.delivery_notes || 'None',
      ];

  return {
  name: process.env.WHATSAPP_TEMPLATE_NAME,
  language: {
    code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
  },
  components: [{
    type: 'body',
    parameters: parameters.slice(0, parameterLimit).map((text) => ({ type: 'text', text })),
  }],
  };
};

const sendWhatsAppMessage = async (to, order) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

  if (!isConfigured(phoneNumberId)) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is missing or still has its placeholder value.');
  }
  if (!isConfigured(accessToken)) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is missing or still has its placeholder value.');
  }

  const message = process.env.WHATSAPP_TEMPLATE_NAME
    ? { type: 'template', template: buildOrderTemplate(order) }
    : {
        type: 'text',
        text: {
          preview_url: false,
          body: buildOrderMessage(order),
        },
      };

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  };
  const payload = { messaging_product: 'whatsapp', to, ...message };

  try {
    return await axios.post(url, payload, config);
  } catch (error) {
    if (
      message.type !== 'template' ||
      error.response?.data?.error?.code !== 132000 ||
      message.template.components[0].parameters.length <= 3
    ) {
      throw error;
    }

    console.warn('WhatsApp template expects fewer parameters; retrying with grouped order details.');
    const fallbackPayload = {
      ...payload,
      template: buildOrderTemplate(order, 3),
    };
    return axios.post(url, fallbackPayload, config);
  }
};

const notifyOrderCreated = async (order) => {
  if (process.env.WHATSAPP_ENABLED !== 'true') return;

  const adminPhone = normalizePhone(process.env.WHATSAPP_ADMIN_PHONE);
  if (!isConfigured(process.env.WHATSAPP_ADMIN_PHONE) || !/^\d{8,15}$/.test(adminPhone)) {
    throw new Error('WHATSAPP_ADMIN_PHONE must be a real number in international format, for example 254712345678.');
  }

  return sendWhatsAppMessage(adminPhone, order);
};

module.exports = { notifyOrderCreated };
