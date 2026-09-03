const crypto = require('crypto');
const fallbackConfig = require('./config');

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function makeToken(payload, secret) {
  const raw = JSON.stringify(payload);
  const encoded = Buffer.from(raw, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token, secret) {
  try {
    const [encoded, signature] = String(token || '').split('.');
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || !payload.ts || Date.now() - Number(payload.ts) > 20 * 60 * 1000) return null;
    if (Date.now() + 60 * 1000 < Number(payload.ts)) return null;
    return payload;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function buildTelegramText({ product, amount, total, id, invoice, invoiceId, paidAt }) {
  return [
    '<b>╔══════════════════════╗</b>',
    '<b>   ✅ PEMBAYARAN BERHASIL   </b>',
    '<b>╚══════════════════════╝</b>',
    '',
    '<b>🧾 INVOICE FROGZZSHOP</b>',
    `├─ 🛍️ <b>Produk:</b> ${escapeHtml(product)}`,
    `├─ 💵 <b>Harga:</b> ${escapeHtml(formatMoney(amount))}`,
    `├─ 💳 <b>Total Dibayar:</b> ${escapeHtml(formatMoney(total))}`,
    `├─ 🧾 <b>Invoice:</b> <code>${escapeHtml(invoiceId || '-')}</code>`,
    `├─ 🆔 <b>ID TRX Depo:</b> <code>${escapeHtml(id)}</code>`,
    invoice ? `├─ 🌐 <b>Invoice XS-Pedia:</b> <code>${escapeHtml(invoice)}</code>` : null,
    `├─ ✅ <b>Status:</b> <b>LUNAS</b>`,
    `└─ 🕐 <b>Waktu:</b> ${escapeHtml(paidAt)}`,
    '',
    '<b>⚠️ SIMPAN ID TRX DEPO</b>',
    `<code>${escapeHtml(id)}</code>`,
    '',
    'Pembayaran telah terverifikasi otomatis dari FrogzzShop.'
  ].filter(Boolean).join('\n');
}

async function sendTelegramNotification(payload = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || fallbackConfig.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID || process.env.TELEGRAM_OWNER_ID || fallbackConfig.TELEGRAM_OWNER_CHAT_ID;
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram owner notification belum dikonfigurasi.' };
  }

  const product = String(payload.product || 'Order').trim().slice(0, 120);
  const amount = Number(payload.amount || 0);
  const total = Number(payload.total || amount);
  const id = String(payload.id || '').trim();
  const invoice = String(payload.invoice || '').trim().slice(0, 120);
  const invoiceId = String(payload.invoiceId || '').trim().slice(0, 120);
  const paidAt = payload.paidAt || new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  if (!id) return { success: false, message: 'ID transaksi kosong.' };

  const text = buildTelegramText({ product, amount, total, id, invoice, invoiceId, paidAt });
  const telegramResponse = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  const telegramData = await telegramResponse.json().catch(() => ({}));

  if (!telegramResponse.ok || telegramData.ok !== true) {
    return { success: false, message: telegramData.description || 'Telegram gagal menerima notifikasi.' };
  }

  return { success: true, message_id: telegramData.result?.message_id || null };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const secret = process.env.FROGZZ_NOTIFY_SECRET || process.env.XS_PEDIA_APIKEY || '';
    if (!secret) {
      return res.status(500).json({ success: false, message: 'Signing secret belum dikonfigurasi.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const tokenPayload = verifyToken(body.token, secret);
    if (!tokenPayload) {
      return res.status(403).json({ success: false, message: 'Token notifikasi tidak valid atau sudah kedaluwarsa.' });
    }

    if (String(body.id || '') !== String(tokenPayload.id || '')) {
      return res.status(403).json({ success: false, message: 'ID transaksi tidak cocok.' });
    }

    const result = await sendTelegramNotification({
      id: tokenPayload.id,
      product: tokenPayload.product || body.product,
      amount: tokenPayload.amount || body.amount,
      total: tokenPayload.total || body.total,
      invoice: tokenPayload.invoice || body.invoice,
      invoiceId: tokenPayload.invoiceId || body.invoiceId,
      paidAt: body.paidAt
    });

    if (!result.success) return res.status(502).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('notify-telegram error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengirim notifikasi Telegram.' });
  }
}

module.exports = { handler, makeToken, sendTelegramNotification };
