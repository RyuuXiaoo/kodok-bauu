async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.XS_PEDIA_APIKEY || process.env.XS_PEDIA_API_KEY;
    const baseUrl = (process.env.XS_PEDIA_BASE_URL || 'https://xs-pedia.my.id').replace(/\/$/, '');
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'XS_PEDIA_APIKEY belum diatur di environment.' });
    }

    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'ID transaksi wajib diisi.' });

    const params = new URLSearchParams({ id });
    const response = await fetch(`${baseUrl}/h2h/deposit/status?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-APIKEY': apiKey, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return res.status(502).json({ success: false, message: data.message || `XS-Pedia mengembalikan HTTP ${response.status}` });
    }

    return res.status(200).json({ success: true, data: data.data || {} });
  } catch (error) {
    console.error('check-payment error:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengecek pembayaran.' });
  }
}


module.exports = handler;
