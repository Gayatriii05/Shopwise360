require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Email dispatch for ShopWise 360.
//
// Transport selection (chosen lazily on first send, cached after):
//   MAIL_TRANSPORT=ethereal (default when no SMTP configured)
//       Free dev provider — a fresh Ethereal test account is created on first
//       send and the preview URL is logged to the console so you can open the
//       message in a browser. No registration, no costs.
//   MAIL_TRANSPORT=smtp  (set SMTP_HOST; production)
//       Uses SMTP_HOST/PORT/USER/PASS/FROM. Best-effort — mail never breaks
//       an API request.
//   MAIL_TRANSPORT=json  (test/dry-run)
//       No network — writes the composed message to MAIL_DUMP_DIR as JSON.
//       Used by the automated verification suite to assert mail is wired up
//       to the right events without depending on a live SMTP round-trip.
//
// All sends are fire-and-forget: never await a mail in a request handler, use
// `dispatch(mailPromise)` so a slow/down mail relay cannot hurt API latency.

const DEFAULT_FROM = 'ShopWise 360 <no-reply@shopwise360.local>';
const DUMP_DIR = process.env.MAIL_DUMP_DIR || path.join(__dirname, '..', 'data', 'mail');

let cachedTransport = null;

async function getTransport() {
  if (cachedTransport) return cachedTransport;

  const mode = process.env.MAIL_TRANSPORT || (process.env.SMTP_HOST ? 'smtp' : 'ethereal');

  if (mode === 'smtp') {
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE) === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    console.log('[mail] using SMTP transport:', process.env.SMTP_HOST);
  } else if (mode === 'json') {
    cachedTransport = nodemailer.createTransport({ jsonTransport: true });
    if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });
    console.log('[mail] using JSON test transport — dumping to', DUMP_DIR);
  } else {
    // Ethereal: create a disposable test account (cached across sends).
    const account = await nodemailer.createTestAccount();
    cachedTransport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
    console.log('[mail] using Ethereal test transport:', account.user);
  }
  cachedTransport._mode = mode;
  return cachedTransport;
}

/**
 * Low-level send. Resolves with { status, messageId, previewUrl, info?, error? }.
 * Never throws — always resolves, so callers can fire-and-forget safely.
 */
async function sendMail({ to, subject, text, html }) {
  try {
    const transport = await getTransport();
    const from = transport._mode === 'ethereal' ? undefined : (process.env.SMTP_FROM || process.env.MAIL_FROM || DEFAULT_FROM);
    const msg = { from, to, subject, text, html };
    const info = await transport.sendMail(msg);

    let previewUrl = null;
    if (transport._mode === 'json') {
      const payload = { ...msg, messageId: info.messageId || null };
      previewUrl = JSON.stringify(payload, null, 2);
      const file = path.join(DUMP_DIR, `mail-${Date.now()}-${Math.round(Math.random() * 1e9)}.json`);
      await fs.promises.writeFile(file, previewUrl, 'utf8');
      previewUrl = file;
    } else if (transport._mode === 'ethereal' && typeof nodemailer.getTestMessageUrl === 'function') {
      previewUrl = nodemailer.getTestMessageUrl(info) || null;
      if (previewUrl) console.log('[mail] preview:', previewUrl);
    }

    return { status: 'sent', messageId: info.messageId || null, previewUrl, info };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { status: 'error', error: err.message };
  }
}

// Fire-and-forget wrapper for request handlers (never throws / never blocks).
function dispatch(promise) {
  promise.then((res) => {
    if (res.error && res.status === 'error') { /* already logged */ }
    else if (process.env.MAIL_DEBUG === 'true') console.log('[mail] dispatched:', res.status, res.messageId);
  });
  return null;
}

// ---- Convenience builders ----

function sendOrderConfirmation({ to, customerName, orderId, total, retailerName, items }) {
  const lines = items.map((i) => `${i.name} × ${i.quantity} — ₹${Number(i.price).toFixed(2)}`).join('\n');
  const text = [
    `Hi ${customerName || 'there'},`,
    '',
    `Your order #${orderId} from ${retailerName} is confirmed.`,
    '',
    items.length
      ? `Items:\n${lines}`
      : 'Items on the way.',
    '',
    `Total: ₹${Number(total).toFixed(2)}`,
    '',
    'We’ll email you as the order moves through its status updates.',
    '', '— ShopWise 360'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:4px">Order Confirmation</h2>
      <p style="margin:0 0 16px;color:#64748b">ShopWise 360</p>
      <p>Hi ${escapeHtml(customerName || 'there')},</p>
      <p>Your order <strong>#${orderId}</strong> from <strong>${escapeHtml(retailerName || 'our store')}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr style="background:#f1f5f9"><th style="text-align:left;padding:6px 8px;font-size:12px">Item</th><th style="text-align:right;padding:6px 8px;font-size:12px">Qty</th><th style="text-align:right;padding:6px 8px;font-size:12px">Price</th></tr>
        ${items.map((i) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:6px 8px">${escapeHtml(i.name)}</td><td style="text-align:right;padding:6px 8px">${i.quantity}</td><td style="text-align:right;padding:6px 8px">₹${Number(i.price).toFixed(2)}</td></tr>`).join('')}
      </table>
      <p style="font-size:15px"><strong>Total: ₹${Number(total).toFixed(2)}</strong></p>
      <p style="color:#64748b;font-size:13px">We’ll email you as the order moves through its status updates.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px">— ShopWise 360</p>
    </div>`;
  return sendMail({ to, subject: `Order #${orderId} confirmed — ${retailerName || 'ShopWise 360'}`, text, html });
}

function sendOrderStatusChange({ to, customerName, orderId, newStatus, oldStatus }) {
  const text = [
    `Hi ${customerName || 'there'},`,
    '',
    `Your order #${orderId} is now ${newStatus}.`,
    oldStatus ? `(previous status: ${oldStatus})` : '',
    '',
    'Track it anytime from your customer dashboard.',
    '', '— ShopWise 360'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:4px">Order Status Update</h2>
      <p style="margin:0 0 16px;color:#64748b">ShopWise 360</p>
      <p>Hi ${escapeHtml(customerName || 'there')},</p>
      <p>Your order <strong>#${orderId}</strong> is now <strong>${escapeHtml(newStatus)}</strong>${oldStatus ? ` (was ${escapeHtml(oldStatus)})` : ''}.</p>
      <p>Track it anytime from your customer dashboard.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px">— ShopWise 360</p>
    </div>`;
  return sendMail({ to, subject: `Order #${orderId} ${newStatus}`, text, html });
}

function sendLowStockAlert({ to, storeName, productName, quantity, threshold }) {
  const text = [
    `Low stock alert for ${storeName || 'your store'}.`,
    '',
    `Product: ${productName}`,
    `Current quantity: ${quantity}`,
    `Threshold: ${threshold}`,
    '',
    'Reorder before the item runs out.',
    '', '— ShopWise 360'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:4px">⚠️ Low Stock Alert</h2>
      <p style="margin:0 0 16px;color:#64748b">ShopWise 360</p>
      <p><strong>${escapeHtml(storeName || 'Your store')}</strong></p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b">Product</td><td style="padding:6px 0"><strong>${escapeHtml(productName)}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b">Current quantity</td><td style="padding:6px 0">${quantity}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b">Threshold</td><td style="padding:6px 0">${threshold}</td></tr>
      </table>
      <p>Reorder before the item runs out.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px">— ShopWise 360</p>
    </div>`;
  return sendMail({ to, subject: `Low stock: ${productName} (${quantity} left)`, text, html });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { sendMail, sendOrderConfirmation, sendOrderStatusChange, sendLowStockAlert, dispatch, getTransport };