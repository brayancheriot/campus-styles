
const axios = require('axios');

const SMS_API_URL = 'https://sms.textsms.co.ke/api/services/sendsms/';

const normalizePhone = (phone) => {
  if (!phone) return '';

  let cleaned = String(phone).replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = `254${cleaned.slice(1)}`;
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = `254${cleaned}`;
  }

  return cleaned;
};

const formatKES = (amount) => {
  const value = Number(amount) || 0;
  return `KSh ${Math.round(value).toLocaleString('en-KE')}`;
};

const isConfigured = (value) => {
  const normalized = String(value || '').trim();

  return (
    normalized !== '' &&
    !/^(your_|replace[-_]?me|change[-_]?me)/i.test(normalized)
  );
};


const buildOrderMessage = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];

  const itemCount = items.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  const message = [
    `NEW ORDER: ${order.tracking_number || order.id}`,
    `Name: ${order.full_name || 'N/A'}`,
    `Phone: ${order.phone || 'N/A'}`,
    `Items: ${itemCount}`,
    `Total: KSh ${Math.round(Number(order.total_price) || 0)}`,
    `Pay: ${order.payment_method || 'N/A'}`,
  ].join('\n');

  console.info('Order SMS length:', message.length);

  if (message.length > 160) {
    console.warn('Order SMS exceeds 160 characters.');
  }

  return message;
};


const sendSMS = async (mobile, message) => {
  const apiKey = process.env.TEXTSMS_API_KEY?.trim();
  const partnerID = process.env.TEXTSMS_PARTNER_ID?.trim();
  const shortcode = process.env.TEXTSMS_SHORTCODE?.trim();

  if (!isConfigured(apiKey)) {
    throw new Error('TEXTSMS_API_KEY is missing or not configured.');
  }

  if (!isConfigured(partnerID)) {
    throw new Error('TEXTSMS_PARTNER_ID is missing or not configured.');
  }

  if (!isConfigured(shortcode)) {
    throw new Error('TEXTSMS_SHORTCODE is missing or not configured.');
  }

  try {
    const response = await axios.post(
      SMS_API_URL,
      {
        apikey: apiKey,
        partnerID,
        mobile,
        message,
        shortcode,
        pass_type: 'plain',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 20000,
      }
    );

    console.info('TextSMS HTTP status:', response.status);

    // TextSMS documents the response as:
    // { responses: [{ "respose-code": 200, ... }] }

    const responseData = response.data;

    console.info(
      'TextSMS gateway response:',
      JSON.stringify(responseData, null, 2)
    );

    const result = Array.isArray(responseData?.responses)
      ? responseData.responses[0]
      : Array.isArray(responseData)
        ? responseData[0]
        : responseData;

    if (!result || typeof result !== 'object') {
      throw new Error(
        'TextSMS returned an unexpected response format.'
      );
    }

    // The provider documentation spells this field "respose-code".
    const responseCode = Number(
      result['respose-code'] ??
      result['response-code'] ??
      result.responseCode
    );

    if (responseCode !== 200) {
      throw new Error(
        `TextSMS rejected the request. Code: ${
          responseCode || 'Unknown'
        }. Reason: ${
          result['response-description'] ||
          result.message ||
          'No error description returned.'
        }`
      );
    }

    console.info('TextSMS gateway accepted the SMS:', {
      messageId: result.messageid || null,
      mobile: result.mobile || mobile,
      description: result['response-description'] || null,
    });

    return result;

  } catch (error) {
    console.error('TextSMS API request failed:', {
      httpStatus: error.response?.status || null,
      response: error.response?.data || null,
      message: error.message,
    });

    throw error;
  }
};

const notifyOrderCreated = async (order) => {
  if (process.env.SMS_ENABLED !== 'true') {
    console.info('SMS notifications are disabled.');
    return null;
  }

  const adminPhone = normalizePhone(process.env.SMS_ADMIN_PHONE);

  if (!/^254[17]\d{8}$/.test(adminPhone)) {
    throw new Error(
      'SMS_ADMIN_PHONE must be a valid Kenyan mobile number, e.g. 254712345678.'
    );
  }

  if (!order) {
    throw new Error('Cannot send order notification: order details are missing.');
  }

  const message = buildOrderMessage(order);

  return sendSMS(adminPhone, message);
};

module.exports = {
  notifyOrderCreated,
};
