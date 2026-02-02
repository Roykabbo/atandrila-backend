const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

function getFromAddress() {
  const name = process.env.SMTP_FROM_NAME || 'Atandrila';
  const email = process.env.SMTP_FROM || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

function formatPrice(price) {
  return `৳${parseFloat(price).toLocaleString('en-BD')}`;
}

/**
 * Send email with error handling (non-blocking)
 */
async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('Email not configured. Skipping email to:', to);
      return false;
    }

    const info = await getTransporter().sendMail({
      from: getFromAddress(),
      to,
      subject,
      html
    });

    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return false;
  }
}

/**
 * Notify admin about a new order
 */
async function notifyAdminNewOrder(order) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return;

  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5174';

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.size || '-'} / ${item.color || '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</td>
    </tr>
  `).join('');

  const customerName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : order.guestName || 'Guest';

  const customerEmail = order.user?.email || order.guestEmail || '-';
  const customerPhone = order.user?.phone || order.guestPhone || '-';

  const shippingAddr = order.shippingAddress;
  const addressHtml = shippingAddr ? `
    <p style="margin:4px 0;"><strong>${shippingAddr.recipientName}</strong></p>
    <p style="margin:4px 0;">${shippingAddr.addressLine1}</p>
    ${shippingAddr.addressLine2 ? `<p style="margin:4px 0;">${shippingAddr.addressLine2}</p>` : ''}
    <p style="margin:4px 0;">${shippingAddr.city}, ${shippingAddr.district}${shippingAddr.postalCode ? ` - ${shippingAddr.postalCode}` : ''}</p>
    <p style="margin:4px 0;">Phone: ${shippingAddr.phone}</p>
  ` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0A0A0A;padding:20px;text-align:center;">
        <h1 style="color:#D4AF37;margin:0;font-size:24px;">New Order Received!</h1>
      </div>

      <div style="padding:24px;background:#fff;">
        <div style="background:#FFF8DC;padding:16px;border-radius:4px;margin-bottom:20px;">
          <h2 style="margin:0 0 8px;color:#333;font-size:18px;">Order #${order.orderNumber}</h2>
          <p style="margin:0;color:#666;">Payment: <strong>Cash on Delivery</strong></p>
          <p style="margin:4px 0 0;color:#666;">Total: <strong style="font-size:18px;color:#333;">${formatPrice(order.total)}</strong></p>
        </div>

        <h3 style="color:#333;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Customer</h3>
        <p style="margin:4px 0;"><strong>${customerName}</strong></p>
        <p style="margin:4px 0;">Email: ${customerEmail}</p>
        <p style="margin:4px 0;">Phone: ${customerPhone}</p>

        <h3 style="color:#333;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Shipping Address</h3>
        ${addressHtml}

        <h3 style="color:#333;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Items</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Product</th>
              <th style="padding:8px 12px;text-align:left;">Variant</th>
              <th style="padding:8px 12px;text-align:center;">Qty</th>
              <th style="padding:8px 12px;text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:4px;">
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:4px 0;">Subtotal</td>
              <td style="text-align:right;">${formatPrice(order.subtotal)}</td>
            </tr>
            ${order.discountAmount > 0 ? `
            <tr style="color:green;">
              <td style="padding:4px 0;">Discount</td>
              <td style="text-align:right;">-${formatPrice(order.discountAmount)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 0;">Shipping</td>
              <td style="text-align:right;">${order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Free'}</td>
            </tr>
            <tr style="font-weight:bold;font-size:16px;border-top:2px solid #ddd;">
              <td style="padding:8px 0 0;">Total</td>
              <td style="text-align:right;padding:8px 0 0;">${formatPrice(order.total)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="${adminUrl}/orders/${order.id}"
             style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 32px;border-radius:4px;font-weight:bold;font-size:14px;">
            View Order in Admin Panel
          </a>
        </div>

        ${order.notes ? `
        <div style="margin-top:20px;padding:12px;background:#fff3cd;border-radius:4px;">
          <strong>Customer Note:</strong>
          <p style="margin:4px 0 0;">${order.notes}</p>
        </div>` : ''}
      </div>

      <div style="background:#0A0A0A;padding:16px;text-align:center;">
        <p style="color:#888;margin:0;font-size:12px;">Atandrila Admin Notification</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `New Order #${order.orderNumber} - ${formatPrice(order.total)} (COD)`,
    html
  });
}

/**
 * Send order confirmation to customer
 */
async function sendOrderConfirmation(order) {
  const customerEmail = order.user?.email || order.guestEmail;
  if (!customerEmail) return;

  const customerName = order.user
    ? order.user.firstName
    : (order.guestName || '').split(' ')[0] || 'there';

  const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5173';

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0A0A0A;padding:20px;text-align:center;">
        <h1 style="color:#D4AF37;margin:0;font-size:28px;">Atandrila</h1>
      </div>

      <div style="padding:24px;background:#fff;">
        <h2 style="color:#333;margin:0 0 8px;">Thank you, ${customerName}!</h2>
        <p style="color:#666;margin:0 0 20px;">Your order has been placed successfully. We'll start processing it shortly.</p>

        <div style="background:#FFF8DC;padding:16px;border-radius:4px;text-align:center;margin-bottom:20px;">
          <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order Number</p>
          <p style="margin:4px 0 0;color:#333;font-size:20px;font-weight:bold;">${order.orderNumber}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Product</th>
              <th style="padding:8px 12px;text-align:center;">Qty</th>
              <th style="padding:8px 12px;text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="margin-top:12px;padding:12px;background:#f5f5f5;border-radius:4px;">
          <table style="width:100%;font-size:14px;">
            <tr>
              <td>Subtotal</td>
              <td style="text-align:right;">${formatPrice(order.subtotal)}</td>
            </tr>
            ${order.discountAmount > 0 ? `
            <tr style="color:green;">
              <td>Discount</td>
              <td style="text-align:right;">-${formatPrice(order.discountAmount)}</td>
            </tr>` : ''}
            <tr>
              <td>Shipping</td>
              <td style="text-align:right;">${order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Free'}</td>
            </tr>
            <tr style="font-weight:bold;font-size:16px;border-top:2px solid #ddd;">
              <td style="padding:8px 0 0;">Total (COD)</td>
              <td style="text-align:right;padding:8px 0 0;">${formatPrice(order.total)}</td>
            </tr>
          </table>
        </div>

        <p style="color:#666;font-size:13px;margin:16px 0 0;">
          Payment method: <strong>Cash on Delivery</strong> - You will pay when your order is delivered.
        </p>

        <div style="margin-top:24px;text-align:center;">
          <a href="${customerUrl}/track-order?orderNumber=${order.orderNumber}"
             style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 32px;border-radius:4px;font-weight:bold;">
            Track Your Order
          </a>
        </div>

        <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">
          Estimated delivery: 3-5 business days
        </p>
      </div>

      <div style="background:#0A0A0A;padding:16px;text-align:center;">
        <p style="color:#888;margin:0;font-size:12px;">
          Questions? Reply to this email or contact us at support@atandrila.com
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: customerEmail,
    subject: `Order Confirmed - #${order.orderNumber} | Atandrila`,
    html
  });
}

/**
 * Notify customer of order status change
 */
async function sendOrderStatusUpdate(order, newStatus, note) {
  const customerEmail = order.user?.email || order.guestEmail;
  if (!customerEmail) return;

  const customerName = order.user
    ? order.user.firstName
    : (order.guestName || '').split(' ')[0] || 'there';

  const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5173';

  const statusMessages = {
    confirmed: 'Your order has been confirmed and will be processed soon.',
    processing: 'Your order is being prepared for shipment.',
    shipped: 'Your order has been shipped and is on its way!',
    out_for_delivery: 'Your order is out for delivery. It should arrive today!',
    delivered: 'Your order has been delivered. We hope you love it!',
    cancelled: 'Your order has been cancelled.',
    refunded: 'Your order has been refunded.'
  };

  const statusLabels = {
    confirmed: 'Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded'
  };

  const statusColors = {
    confirmed: '#3B82F6',
    processing: '#6366F1',
    shipped: '#8B5CF6',
    out_for_delivery: '#F59E0B',
    delivered: '#10B981',
    cancelled: '#EF4444',
    refunded: '#6B7280'
  };

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0A0A0A;padding:20px;text-align:center;">
        <h1 style="color:#D4AF37;margin:0;font-size:28px;">Atandrila</h1>
      </div>

      <div style="padding:24px;background:#fff;">
        <h2 style="color:#333;margin:0 0 8px;">Hi ${customerName},</h2>
        <p style="color:#666;margin:0 0 20px;">${statusMessages[newStatus] || 'Your order status has been updated.'}</p>

        <div style="background:#f5f5f5;padding:16px;border-radius:4px;border-left:4px solid ${statusColors[newStatus] || '#D4AF37'};">
          <p style="margin:0;font-size:12px;color:#666;">Order #${order.orderNumber}</p>
          <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:${statusColors[newStatus] || '#333'};">
            ${statusLabels[newStatus] || newStatus}
          </p>
          ${note ? `<p style="margin:8px 0 0;color:#666;font-size:13px;">${note}</p>` : ''}
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="${customerUrl}/track-order?orderNumber=${order.orderNumber}"
             style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:12px 32px;border-radius:4px;font-weight:bold;">
            Track Your Order
          </a>
        </div>
      </div>

      <div style="background:#0A0A0A;padding:16px;text-align:center;">
        <p style="color:#888;margin:0;font-size:12px;">
          Questions? Reply to this email or contact us at support@atandrila.com
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: customerEmail,
    subject: `Order ${statusLabels[newStatus] || 'Updated'} - #${order.orderNumber} | Atandrila`,
    html
  });
}

module.exports = {
  sendEmail,
  notifyAdminNewOrder,
  sendOrderConfirmation,
  sendOrderStatusUpdate
};
