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

const sendWhatsAppText = async (to, body) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials are not configured.');
  }

  await axios.post(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
};

const notifyOrderCreated = async (order) => {
  if (process.env.WHATSAPP_ENABLED !== 'true') return;

  const adminPhone = normalizePhone(process.env.WHATSAPP_ADMIN_PHONE);
  if (!adminPhone) {
    throw new Error('WHATSAPP_ADMIN_PHONE is not configured.');
  }

  await sendWhatsAppText(adminPhone, buildOrderMessage(order));
};

module.exports = { notifyOrderCreated };
