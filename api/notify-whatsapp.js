const fallbackConfig = require('./config');

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function buildWhatsAppText({ product, amount, total, id, invoice, invoiceId, paidAt }) {
  return [
    '*✅ PEMBAYARAN BERHASIL - FROGZZSHOP*',
    '',
    `🛍️ *Produk:* ${product}`,
    `💵 *Harga:* ${formatMoney(amount)}`,
    `💳 *Total Dibayar:* ${formatMoney(total)}`,
    `🧾 *Invoice:* ${invoiceId || '-'}`,
    `🆔 *ID TRX Depo:* ${id}`,
    invoice ? `🌐 *Invoice XS-Pedia:* ${invoice}` : null,
    '✅ *Status:* LUNAS',
    `🕐 *Waktu:* ${paidAt}`,
    '',
    '*⚠️ SIMPAN ID TRX DEPO*',
    id,
    '',
    'Pembayaran telah terverifikasi otomatis dari FrogzzShop.'
  ].filter(Boolean).join('\n');
}

function getOwnerNumbers() {
  const raw = process.env.FONNTE_OWNER_NUMBERS || fallbackConfig.FONNTE_OWNER_NUMBERS || '';
  return [...new Set(
    String(raw)
      .split(/[;,\n]+/)
      .map(v => v.trim().replace(/\s+/g, ''))
      .filter(Boolean)
  )];
}

async function sendWhatsAppNotification(payload = {}) {
  const token = process.env.FONNTE_API_TOKEN || process.env.FONNTE_TOKEN || fallbackConfig.FONNTE_API_TOKEN;
  const owners = getOwnerNumbers();
  if (!token) return { success: false, message: 'FONNTE_API_TOKEN belum dikonfigurasi.' };
  if (!owners.length) return { success: false, message: 'Nomor owner WhatsApp belum dikonfigurasi.' };

  const product = String(payload.product || 'Order').trim().slice(0, 120);
  const amount = Number(payload.amount || 0);
  const total = Number(payload.total || amount);
  const id = String(payload.id || '').trim();
  const invoice = String(payload.invoice || '').trim().slice(0, 120);
  const invoiceId = String(payload.invoiceId || '').trim().slice(0, 120);
  const paidAt = payload.paidAt || new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'medium'
  });

  if (!id) return { success: false, message: 'ID transaksi kosong.' };

  const message = buildWhatsAppText({ product, amount, total, id, invoice, invoiceId, paidAt });
  const target = owners.join(',');

  const form = new URLSearchParams();
  form.set('target', target);
  form.set('message', message);
  form.set('countryCode', '62');
  form.set('delay', '2');

  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: form.toString()
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status === false) {
    return { success: false, message: data.reason || data.message || `Fonnte gagal mengirim notifikasi (HTTP ${response.status}).`, owners };
  }

  return { success: true, owners, response: data };
}

module.exports = { sendWhatsAppNotification, getOwnerNumbers };
