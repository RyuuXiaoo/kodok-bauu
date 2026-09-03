const crypto = require('crypto');
const { sendWhatsAppNotification } = require('./notify-whatsapp');

function makeToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function makeInvoiceId(id) {
  return `FZ-${crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 12).toUpperCase()}`;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.XS_PEDIA_APIKEY || process.env.XS_PEDIA_API_KEY;
    const baseUrl = (process.env.XS_PEDIA_BASE_URL || 'https://xs-pedia.my.id').replace(/\/$/, '');
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'XS_PEDIA_APIKEY belum diatur di environment.' });
    }

    const rawId = req.query?.id;
    const id = String(Array.isArray(rawId) ? rawId[0] : (rawId || '')).trim();
    if (!id) return res.status(400).json({ success: false, message: 'ID transaksi wajib diisi.' });

    const url = `${baseUrl}/h2h/deposit/status?${new URLSearchParams({ id }).toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-APIKEY': apiKey, 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success !== true) {
      return res.status(502).json({
        success: false,
        message: data.message || `XS-Pedia gagal mengecek status (HTTP ${response.status}).`
      });
    }

    const detail = data.data || {};
    const status = String(detail.status || detail.transaction_status || detail.payment_status || 'pending').trim().toLowerCase();
    const responseData = {
      ...detail,
      id: String(detail.id || detail.invoice || detail.transaction_id || id),
      status
    };

    if (['success', 'paid', 'completed', 'berhasil'].includes(status)) {
      const product = String(req.query?.product || 'Order').slice(0, 120);
      const amount = Number(req.query?.amount || detail.amount || detail.nominal || 0);
      const total = Number(detail.total_amount || detail.paid_amount || detail.amount || amount);
      const invoice = String(detail.invoice || detail.reference || '').slice(0, 120);
      const invoiceId = String(req.query?.invoice_id || makeInvoiceId(id)).slice(0, 120);
      const secret = process.env.FROGZZ_NOTIFY_SECRET || apiKey;

      responseData.invoice = invoice || null;
      responseData.invoice_id = invoiceId;
      responseData.notify_token = makeToken({
        id,
        product,
        amount,
        total,
        invoice,
        invoiceId,
        ts: Date.now()
      }, secret);

      const paidAt = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'full',
        timeStyle: 'medium'
      });

      // Notifikasi dikirim dari server, bukan dari browser, agar tidak gagal saat browser redirect.
      try {
        const whatsapp = await sendWhatsAppNotification({
          id,
          product,
          amount,
          total,
          invoice,
          invoiceId,
          paidAt
        });
        responseData.whatsapp_notified = Boolean(whatsapp.success);
        if (whatsapp.success) responseData.whatsapp_owners = whatsapp.owners;
        if (!whatsapp.success) responseData.whatsapp_error = whatsapp.message;
      } catch (whatsappError) {
        responseData.whatsapp_notified = false;
        responseData.whatsapp_error = whatsappError?.message || 'WhatsApp notification error';
      }
    }

    return res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error('check-payment error:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengecek pembayaran.' });
  }
}

module.exports = handler;
