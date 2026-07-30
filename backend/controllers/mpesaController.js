/* ============================================
   PAULINE FASHION STORE - M-PESA DARAJA CONTROLLER
   ============================================ */

const axios = require('axios');
const { transaction, query, queryOne } = require('../config/db');

/* ============================================
   UTILITY & HELPERS (PRODUCTION SECURE)
   ============================================ */

/**
 * Fetches a secure OAuth Access Token from Safaricom.
 * Restricts hanging threads with a definitive network timeout.
 */
const getAccessToken = async () => {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;

  if (!key || !secret) {
    throw new Error('M-Pesa credentials not configured.');
  }

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  
  const response = await axios.get(
    `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { 
      headers: { Authorization: `Basic ${credentials}` },
      timeout: 8000 // 8-second limit ensures server thread isn't stranded
    }
  );

  return response.data.access_token;
};

/**
 * Normalizes user-inputted phone formats to the rigid 2547XXXXXXXX standard.
 */
const formatPhone = (phone) => {
  if (!phone) throw new Error('Phone number is required.');
  let cleaned = String(phone).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = `254${cleaned.slice(1)}`;
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = `254${cleaned}`;

  if (!/^254(?:7|1)\d{8}$/.test(cleaned)) {
    throw new Error('Invalid phone number format. Use 0712345678 or 254712345678.');
  }

  return cleaned;
};

/**
 * Overrides cloud container system clocks to force strict Africa/Nairobi Time (UTC+3).
 * Prevents Daraja server rejections due to server-to-gateway timezone skew.
 */
const getTimestamp = () => {
  const options = {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  
  const getPart = (type) => parts.find(p => p.type === type).value;
  return `${getPart('year')}${getPart('month')}${getPart('day')}${getPart('hour')}${getPart('minute')}${getPart('second')}`;
};

/**
 * Encrypts and builds the temporary operational string signature payload.
 */
const getPassword = (timestamp) => {
  const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
};

/**
 * Production Hardening Filter: Mandates valid token secrets AND verifies that
 * incoming traffic originates from official Safaricom white-listed subnets.
 */
const callbackIsAuthorized = (req) => {
  const expectedSecret = process.env.MPESA_CALLBACK_SECRET;
  const incomingSecret = req.query.secret || req.get('x-mpesa-callback-secret');
  
  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return false;
  }

  if (process.env.NODE_ENV !== 'production') return true;

  const incomingIp = req.ip || req.connection.remoteAddress;
  // Official Safaricom production application API gateway edges
  const safaricomIps = [
    '196.201.214.200', '196.201.214.206', '196.201.213.114', 
    '196.201.214.207', '196.201.214.208', '196.201.213.44'
  ];
  
  // Read true client IP if your node instance is hosted behind cloud proxies like Render or Cloudflare
  const realIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || incomingIp;

  return safaricomIps.includes(realIp);
};


/* ============================================
   CORE API ENDPOINTS
   ============================================ */

/**
 * POST /api/payments/stkpush
 * Securely prepares order attributes and fires a real-time STK Push trigger to the device.
 */
const initiateSTKPush = async (req, res) => {
  try {
    const { phone, orderId, description } = req.body;

    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!orderId) return res.status(400).json({ success: false, message: 'Order ID is required.' });

    // Validate that the request context belongs to the authenticated user token
    const order = await queryOne(
      `SELECT id, user_id, deposit_amount, payment_status, phone
       FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, req.user.id]
    );

    if (!order) return res.status(404).json({ success: false, message: 'Order record not found.' });
    if (order.payment_status === 'Deposit Paid') {
      return res.status(400).json({ success: false, message: 'This order deposit is already processed.' });
    }

    const formattedPhone = formatPhone(phone);
    const orderPhone = formatPhone(order.phone);
    if (formattedPhone !== orderPhone) {
      return res.status(400).json({ success: false, message: 'Payment phone must match your account phone number.' });
    }

    const formattedAmount = Math.ceil(Number(order.deposit_amount));
    if (!Number.isFinite(formattedAmount) || formattedAmount < 1) {
      return res.status(400).json({ success: false, message: 'Order deposit validation failed: Invalid balance.' });
    }

    const accessToken = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);
    const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline', // Works seamlessly for Buy Goods Tills/Store Numbers
      Amount: formattedAmount,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: `PaulineFashion-${order.id}`,
      TransactionDesc: description || 'Pauline Fashion Checkout Deposit',
    };

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // Strict 10-second request isolation boundary
      }
    );

    const data = response.data;
    if (data.ResponseCode !== '0') {
      throw new Error(data.errorMessage || data.ResponseDescription || 'STK Push initialization failed.');
    }

    // Cache the unique tracking context into your orders database structure
    await query(
      `UPDATE orders SET payment_reference = ?, payment_status = 'Pending STK'
       WHERE id = ? AND user_id = ?`,
      [data.CheckoutRequestID, order.id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'STK Push transmitted. Check your mobile device for the PIN prompt.',
      checkoutRequestId: data.CheckoutRequestID,
      amount: formattedAmount,
    });

  } catch (error) {
    console.error('STK Push System Failure:', error.response?.data || error.message);
    const message = error.response?.data?.errorMessage || error.message || 'M-Pesa payment integration fault.';
    res.status(400).json({ success: false, message });
  }
};

/**
 * POST /api/payments/callback
 * Concurrency Hardened Endpoint: Safaricom calling webhook interface logic.
 */
const mpesaCallback = async (req, res) => {
  try {
    if (!callbackIsAuthorized(req)) {
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized webhook access attempt' });
    }

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Dropped empty payload' });
    }

    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = stkCallback.ResultDesc;
    const merchantReqId = stkCallback.MerchantRequestID;
    const checkoutReqId = stkCallback.CheckoutRequestID;

    // Execute safe database isolation state edits within an isolated thread block [1]
    await transaction(async ({ query, queryOne }) => {
      
      // Concurrency Shield: Lock row via 'FOR UPDATE' to make other overlapping network checks queue up [1]
      const order = await queryOne(
        `SELECT id, deposit_amount, payment_status, phone 
         FROM orders 
         WHERE payment_reference IN (?, ?) FOR UPDATE`,
        [checkoutReqId, merchantReqId]
      );

      // Verify that this row context hasn't already been fulfilled by another execution thread
      if (!order || order.payment_status !== 'Pending STK') {
        return; 
      }

      if (resultCode === 0) {
        const metadata = stkCallback.CallbackMetadata?.Item || [];
        const getValue = (name) => metadata.find((i) => i.Name === name)?.Value || null;
        
        const amount = Number(getValue('Amount'));
        const mpesaCode = getValue('MpesaReceiptNumber');
        const phone = getValue('PhoneNumber');

        if (!mpesaCode || !Number.isFinite(amount)) return;

        const expectedAmount = Math.ceil(Number(order.deposit_amount));
        const paidAmount = Math.ceil(amount);
        const callbackPhone = formatPhone(String(phone));
        const orderPhone = formatPhone(order.phone);

        // Fail-safe protection: Validate that payment metrics match expectations
        if (paidAmount < expectedAmount || callbackPhone !== orderPhone) {
          await query(`UPDATE orders SET payment_status = 'Unpaid' WHERE id = ?`, [order.id]);
          return;
        }
                // Finalize order fulfillment
        await query(
          `UPDATE orders SET
             payment_status = 'Deposit Paid',
             payment_reference = ?,
             order_status = 'Confirmed'
           WHERE id = ?`,
          [mpesaCode, order.id]
        );

      } else {
        // User cancelled, timed out, or entered a wrong PIN
        await query(
          `UPDATE orders
           SET payment_status = 'Unpaid'
           WHERE id = ?`,
          [order.id]
        );

        console.log(`M-Pesa execution rejected. Reason: ${resultDesc}`);
      }
    });

    // Always inform Safaricom that your server successfully processed the callback
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Accepted successfully',
    });

  } catch (error) {
    console.error(
      'Critical Database Callback Processing Crash:',
      error.response?.data || error.message
    );

    // Respond with HTTP 200 to prevent repeated callback retries
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Handled internally',
    });
  }
};

/* ============================================
   STK PUSH STATUS QUERY
   ============================================ */

/**
 * POST /api/payments/query
 * Polls the current STK Push status.
 */
const querySTKStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    if (!checkoutRequestId || typeof checkoutRequestId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Checkout Request Identifier string missing.',
      });
    }

    // Verify transaction belongs to authenticated user
    const order = await queryOne(
      `SELECT id, payment_status, payment_reference, order_status
       FROM orders
       WHERE payment_reference = ?
         AND user_id = ?`,
      [checkoutRequestId, req.user.id]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Transaction matching error.',
      });
    }

    // Webhook already confirmed payment
    if (order.payment_status === 'Deposit Paid') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'Deposit Paid',
        orderStatus: order.order_status,
        message: 'Payment completed successfully.',
      });
    }

    // Webhook already confirmed failure
    if (order.payment_status === 'Unpaid') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'Unpaid',
        message: 'Transaction request failed or was cancelled.',
      });
    }

    // Query Safaricom directly
    const accessToken = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);
    const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE;

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 6000,
      }
    );

    const data = response.data;

    if (data.ResponseCode === '0') {
      const resultCode = Number(data.ResultCode);

      if (resultCode === 0) {
        await query(
          `UPDATE orders
           SET payment_status = 'Deposit Paid',
               order_status = 'Confirmed'
           WHERE id = ?
             AND payment_status = 'Pending STK'`,
          [order.id]
        );

        return res.status(200).json({
          success: true,
          paymentStatus: 'Deposit Paid',
          orderStatus: 'Confirmed',
          message: 'Payment verified successfully.',
        });
      }

      // Cancelled, timeout, invalid PIN, etc.
      if ([1032, 1037, 2001, 1].includes(resultCode)) {
        await query(
          `UPDATE orders
           SET payment_status = 'Unpaid'
           WHERE id = ?
             AND payment_status = 'Pending STK'`,
          [order.id]
        );

        return res.status(200).json({
          success: true,
          paymentStatus: 'Unpaid',
          message: data.ResultDesc || 'Payment was unsuccessful.',
        });
      }
    }

    // Still waiting for customer response
    return res.status(200).json({
      success: true,
      paymentStatus: 'Pending STK',
      message: 'Awaiting customer mobile PIN confirmation.',
    });

  } catch (error) {
    // 1036 = Transaction still processing
    if (error.response?.data?.ResultCode === '1036') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'Pending STK',
        message: 'Transaction is actively processing.',
      });
    }

    console.error(
      'STK API Status Polling Routing Failure:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to communicate with the payment server gateway at this time.',
    });
  }
};

/* ============================================
   DIAGNOSTIC ENDPOINT
   ============================================ */

/**
 * GET /api/payments/test
 * Tests Daraja API credentials.
 */
const testCredentials = async (req, res) => {
  try {
    await getAccessToken();

    return res.status(200).json({
      success: true,
      message:
        'Safaricom Daraja API authentication validation established successfully.',
      environment: process.env.NODE_ENV || 'development',
      baseUrl: process.env.MPESA_BASE_URL,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        'Failed to authenticate production payment certificates with Safaricom.',
      error: error.message,
    });
  }
};

module.exports = {
  initiateSTKPush,
  mpesaCallback,
  querySTKStatus,
  testCredentials,
};
