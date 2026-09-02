async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.XS_PEDIA_APIKEY || process.env.XS_PEDIA_API_KEY;
    const baseUrl = (process.env.XS_PEDIA_BASE_URL || 'https://xs-pedia.my.id').replace(/\/$/, '');
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'XS_PEDIA_APIKEY belum diatur di environment.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const amount = Number(body.amount);
    const product = String(body.product || 'Order').trim().slice(0, 120);
    const redirectUrl = String(body.redirectUrl || '').trim();

    if (!Number.isInteger(amount) || amount < 10) {
      return res.status(400).json({ success: false, message: 'Nominal minimal Rp10 dan harus berupa angka bulat.' });
    }

    let parsedRedirect;
    try {
      parsedRedirect = new URL(redirectUrl);
      if (!['http:', 'https:'].includes(parsedRedirect.protocol)) throw new Error('protocol');
      const requestHost = String(req.headers?.host || '').split(':')[0].toLowerCase();
      const redirectHost = parsedRedirect.hostname.toLowerCase();
      const sameOrigin = requestHost && redirectHost === requestHost;
      const isDiscord = redirectHost === 'discord.gg';
      if (!sameOrigin && !isDiscord) throw new Error('host');
    } catch {
      return res.status(400).json({ success: false, message: 'Link tujuan order tidak valid.' });
    }

    const params = new URLSearchParams({ nominal: String(amount), metode: 'QRIS' });
    const response = await fetch(`${baseUrl}/h2h/deposit/create?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-APIKEY': apiKey, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return res.status(502).json({
        success: false,
        message: data.message || `XS-Pedia mengembalikan HTTP ${response.status}`
      });
    }

    const qris = data.data || {};
    const transactionId = String(qris.id || qris.invoice || qris.transaction_id || '').trim();
    if (!transactionId || !qris.qr_image) {
      return res.status(502).json({ success: false, message: 'Respons XS-Pedia tidak berisi ID transaksi atau QR image.' });
    }

    const totalAmount = Number(qris.total_amount || qris.amount || amount);
    const expiresAt = qris.expires_at ? new Date(qris.expires_at).getTime() : Date.now() + 15 * 60 * 1000;

    return res.status(200).json({
      success: true,
      data: {
        id: transactionId,
        invoice: qris.invoice || null,
        product,
        amount,
        total_amount: totalAmount,
        fee: Number(qris.fee || Math.max(0, totalAmount - amount)),
        qr_image: qris.qr_image,
        redirect_url: redirectUrl,
        expires_at: expiresAt
      }
    });
  } catch (error) {
    console.error('create-payment error:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat membuat pembayaran.' });
  }
}


module.exports = handler;
