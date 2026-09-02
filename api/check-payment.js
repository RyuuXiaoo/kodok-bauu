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
    return res.status(200).json({
      success: true,
      data: {
        ...detail,
        id: String(detail.id || detail.invoice || detail.transaction_id || id),
        status: detail.status || detail.transaction_status || detail.payment_status || 'pending'
      }
    });
  } catch (error) {
    console.error('check-payment error:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengecek pembayaran.' });
  }
}

module.exports = handler;
