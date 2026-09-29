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

    // ================= DISESUAIKAN: Nembak ke /deposit/create =================
    const params = new URLSearchParams({ nominal: String(amount) });
    const targetUrl = `${baseUrl}/deposit/create?${params.toString()}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 
        'x-api-key': apiKey,
        'X-APIKEY': apiKey, 
        'Accept': 'application/json' 
      },
      cache: 'no-store'
    });
    
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return res.status(response.status !== 200 ? response.status : 400).json({
        success: false,
        message: data.message || `XS-Pedia mengembalikan HTTP ${response.status}`
      });
    }

    const qris = data.data || {};
    const transactionId = String(qris.id || qris.trx_id || qris.reference_id || '').trim();
    const qrImageUrl = qris.qr_image || qris.qr_image_combined || qris.qr_image_raw || '';

    if (!transactionId || !qrImageUrl) {
      return res.status(502).json({ success: false, message: 'Respons XS-Pedia tidak berisi ID transaksi atau QR image.' });
    }

    const totalAmount = Number(qris.total_amount || amount);
    const expiresAt = qris.expires_at ? new Date(qris.expires_at).getTime() : Date.now() + 15 * 60 * 1000;

    return res.status(200).json({
      success: true,
      data: {
        id: transactionId,
        trx_id: transactionId,
        invoice: qris.reference_id || transactionId,
        product,
        amount,
        total_amount: totalAmount,
        kode_unik: Number(qris.kode_unik || qris.tambahan || 0),
        fee: Number(qris.fee || Math.max(0, totalAmount - amount)),
        qr_image: qrImageUrl,
        qris_string: qris.qris_string || '',
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
