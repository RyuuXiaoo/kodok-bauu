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

    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return res.status(400).json({ success: false, message: 'Format Body Request JSON tidak valid.' });
    }

    const amount = Number(body.amount);
    const product = String(body.product || 'Order').trim().slice(0, 120);
    const redirectUrl = String(body.redirectUrl || '').trim();

    if (!Number.isInteger(amount) || amount < 10) {
      return res.status(400).json({ success: false, message: 'Nominal minimal Rp10 dan harus berupa angka bulat.' });
    }

    // ================= VALIDASI REDIRECT URL =================
    if (redirectUrl) {
      try {
        const parsedRedirect = new URL(redirectUrl);
        if (!['http:', 'https:'].includes(parsedRedirect.protocol)) {
          return res.status(400).json({ success: false, message: 'Protokol link tujuan tidak valid.' });
        }
      } catch {
        return res.status(400).json({ success: false, message: 'Link tujuan order tidak valid.' });
      }
    }

    // ================= NEMBAK KE ENDPOINT /h2h/deposit/create (SESUAI DOKUMEN FOTO 2) =================
    const params = new URLSearchParams({ 
      nominal: String(amount),
      metode: 'QRIS' 
    });
    
    const targetUrl = `${baseUrl}/h2h/deposit/create?${params.toString()}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 
        'X-APIKEY': apiKey,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      cache: 'no-store'
    });
    
    const responseText = await response.text();
    let data = {};
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Response non-json dari XS-Pedia:', responseText.slice(0, 200));
      return res.status(502).json({
        success: false,
        message: `XS-Pedia mengembalikan HTTP ${response.status}`
      });
    }

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
    const expiresAt = qris.expires_at 
      ? new Date(qris.expires_at).getTime() 
      : (qris.created_at ? new Date(qris.created_at).getTime() + 15 * 60 * 1000 : Date.now() + 15 * 60 * 1000);

    return res.status(200).json({
      success: true,
      message: 'Pembayaran berhasil dibuat.',
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
