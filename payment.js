(function () {
  'use strict';

  const API = {
    create: '/api/create-payment',
    status: '/api/check-payment'
  };

  const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const styles = `
    .fzpay-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,12,30,.72);backdrop-filter:blur(7px);display:none;align-items:center;justify-content:center;padding:18px}
    .fzpay-overlay.show{display:flex}
    .fzpay-box{width:min(460px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #ece8f8;border-radius:24px;box-shadow:0 28px 80px rgba(21,14,49,.28);padding:22px;font-family:inherit;color:#19162a}
    .fzpay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .fzpay-head h3{margin:0;font-size:20px}
    .fzpay-close{border:0;background:#f2effb;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer}
    .fzpay-meta{display:grid;gap:7px;background:#f8f6ff;border-radius:16px;padding:13px;margin-bottom:16px}
    .fzpay-row{display:flex;justify-content:space-between;gap:15px;font-size:14px}
    .fzpay-row strong{font-weight:700;text-align:right}
    .fzpay-qr{display:block;width:100%;max-width:300px;aspect-ratio:1;margin:8px auto 14px;border-radius:18px;border:1px solid #ebe7f5;object-fit:contain;background:#fff}
    .fzpay-status{text-align:center;font-size:14px;line-height:1.6;margin:12px 0}
    .fzpay-status strong{display:block;font-size:16px}
    .fzpay-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}
    .fzpay-btn{appearance:none;border:0;border-radius:12px;padding:12px 14px;font-weight:700;cursor:pointer;text-decoration:none;text-align:center;font-size:14px}
    .fzpay-btn.primary{background:#171327;color:#fff}
    .fzpay-btn.secondary{background:#efecf8;color:#241f38}
    .fzpay-btn:disabled{opacity:.55;cursor:not-allowed}
    .fzpay-success{display:none;background:#eefbf2;border:1px solid #cdeed7;color:#17602d;border-radius:14px;padding:12px;margin-top:12px}
    .fzpay-success.show{display:block}
    .fzpay-error{display:none;background:#fff1f1;border:1px solid #f2cece;color:#a22a2a;border-radius:14px;padding:12px;margin-top:12px}
    .fzpay-error.show{display:block}
    .fzpay-manual{font-size:12px;color:#6a6479;text-align:center;margin-top:10px}
    @media(max-width:520px){.fzpay-actions{grid-template-columns:1fr}.fzpay-box{padding:18px;border-radius:20px}}
  `;

  const style = document.createElement('style');
  style.textContent = styles;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'fzpay-overlay';
  overlay.innerHTML = `
    <div class="fzpay-box" role="dialog" aria-modal="true" aria-labelledby="fzpay-title">
      <div class="fzpay-head">
        <h3 id="fzpay-title">Pembayaran QRIS</h3>
        <button class="fzpay-close" type="button" aria-label="Tutup">×</button>
      </div>
      <div class="fzpay-meta">
        <div class="fzpay-row"><span>Produk</span><strong id="fzpay-product">-</strong></div>
        <div class="fzpay-row"><span>Nominal</span><strong id="fzpay-total">-</strong></div>
        <div class="fzpay-row"><span>Batas pembayaran</span><strong id="fzpay-expired">15 menit</strong></div>
      </div>
      <img id="fzpay-qr" class="fzpay-qr" alt="QRIS Pembayaran">
      <div id="fzpay-status" class="fzpay-status"><strong>Menunggu pembayaran</strong>Silakan scan QRIS di atas.</div>
      <div id="fzpay-success" class="fzpay-success"></div>
      <div id="fzpay-error" class="fzpay-error"></div>
      <div class="fzpay-actions">
        <button id="fzpay-check" class="fzpay-btn secondary" type="button">↻ Cek Status</button>
        <a id="fzpay-continue" class="fzpay-btn primary" href="#" target="_blank" rel="noopener noreferrer" style="display:none">Lanjut ke tujuan</a>
      </div>
      <div class="fzpay-manual">Status otomatis dicek setiap 3 detik. Kamu juga bisa menekan “Cek Status” secara manual.</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const el = {
    overlay,
    title: overlay.querySelector('#fzpay-title'),
    product: overlay.querySelector('#fzpay-product'),
    total: overlay.querySelector('#fzpay-total'),
    expired: overlay.querySelector('#fzpay-expired'),
    qr: overlay.querySelector('#fzpay-qr'),
    status: overlay.querySelector('#fzpay-status'),
    success: overlay.querySelector('#fzpay-success'),
    error: overlay.querySelector('#fzpay-error'),
    check: overlay.querySelector('#fzpay-check'),
    cont: overlay.querySelector('#fzpay-continue'),
    close: overlay.querySelector('.fzpay-close')
  };

  let pollTimer = null;
  let current = null;
  let busy = false;
  let expiredAt = 0;
  let completed = false;

  const clearPoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const close = () => {
    clearPoll();
    current = null;
    busy = false;
    completed = false;
    el.overlay.classList.remove('show');
  };

  const showError = (message) => {
    el.error.textContent = message;
    el.error.classList.add('show');
  };

  const clearError = () => {
    el.error.textContent = '';
    el.error.classList.remove('show');
  };

  const setStatus = (title, detail) => {
    el.status.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}`;
  };

  const normalizeStatus = (value) => String(value || '').toLowerCase();

  async function checkStatus(manual = false) {
    if (!current || completed || busy) return;
    if (Date.now() >= expiredAt) {
      clearPoll();
      setStatus('⏰ Pembayaran kedaluwarsa', 'Waktu pembayaran sudah habis. Silakan buat transaksi baru.');
      el.check.disabled = true;
      return;
    }

    busy = true;
    el.check.disabled = true;
    if (manual) setStatus('🔄 Mengecek pembayaran...', 'Mohon tunggu sebentar.');
    clearError();

    try {
      const response = await fetch(`${API.status}?id=${encodeURIComponent(current.id)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Gagal mengecek status (${response.status})`);
      }

      const status = normalizeStatus(data.data?.status);
      if (status === 'success' || status === 'paid') {
        completed = true;
        clearPoll();
        const paidAmount = Number(data.data?.total_amount || current.amount);
        el.success.innerHTML = `✅ <strong>Sudah bayar.</strong><br>Nominal pembayaran: <strong>${escapeHtml(money(paidAmount))}</strong>`;
        el.success.classList.add('show');
        setStatus('✅ Pembayaran berhasil', 'Transaksi sudah terkonfirmasi. Kamu akan diarahkan ke tujuan order.');
        el.cont.href = current.redirectUrl;
        el.cont.style.display = 'block';
        el.check.disabled = true;
        setTimeout(() => {
          window.location.href = current.redirectUrl;
        }, 1500);
        return;
      }

      if (['cancel', 'cancelled', 'failed', 'expired'].includes(status)) {
        clearPoll();
        setStatus('⚠️ Transaksi tidak dapat dilanjutkan', `Status pembayaran: ${status}.`);
        el.check.disabled = true;
        return;
      }

      setStatus('⏳ Menunggu pembayaran', 'QRIS belum menerima pembayaran.');
    } catch (error) {
      showError(error.message || 'Terjadi kesalahan saat mengecek status pembayaran.');
    } finally {
      busy = false;
      if (!completed) el.check.disabled = false;
    }
  }

  async function openPayment({ product, amount, redirectUrl }) {
    amount = Number(String(amount).replace(/\D/g, ''));
    if (!Number.isInteger(amount) || amount < 10) {
      alert('Nominal pembayaran tidak valid.');
      return;
    }
    if (!redirectUrl) {
      alert('Tujuan order belum dikonfigurasi.');
      return;
    }

    clearPoll();
    current = null;
    completed = false;
    el.title.textContent = 'Pembayaran QRIS';
    el.product.textContent = product || 'Order';
    el.total.textContent = money(amount);
    el.expired.textContent = 'Membuat QRIS...';
    el.qr.removeAttribute('src');
    el.qr.alt = 'QRIS Pembayaran';
    el.success.classList.remove('show');
    el.success.textContent = '';
    clearError();
    setStatus('⏳ Membuat QRIS...', 'Mohon tunggu.');
    el.cont.style.display = 'none';
    el.check.disabled = true;
    el.overlay.classList.add('show');

    try {
      const response = await fetch(API.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ product, amount, redirectUrl })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || `Gagal membuat QRIS (${response.status})`);

      const qris = data.data;
      const createdAmount = Number(qris.total_amount || qris.amount || amount);
      current = { id: qris.id, amount: createdAmount, redirectUrl: qris.redirect_url || redirectUrl };
      expiredAt = Number(qris.expires_at || (Date.now() + 15 * 60 * 1000));

      el.total.textContent = money(createdAmount);
      el.expired.textContent = new Date(expiredAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      el.qr.src = qris.qr_image;
      setStatus('⏳ Menunggu pembayaran', 'Silakan scan QRIS. Pembayaran akan terdeteksi otomatis.');
      el.check.disabled = false;

      await checkStatus(false);
      pollTimer = setInterval(() => checkStatus(false), 3000);
    } catch (error) {
      clearPoll();
      showError(error.message || 'Tidak dapat membuat QRIS.');
      setStatus('❌ Gagal membuat pembayaran', 'Periksa konfigurasi API lalu coba lagi.');
      el.check.disabled = false;
    }
  }

  el.close.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (!current || completed || Date.now() >= expiredAt) close();
  });
  el.check.addEventListener('click', () => checkStatus(true));

  const bind = (root = document) => {
    root.querySelectorAll('[data-payment-order]').forEach((button) => {
      if (button.dataset.paymentBound === '1') return;
      button.dataset.paymentBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openPayment({
          product: button.dataset.product || button.textContent.trim() || 'Order',
          amount: button.dataset.price,
          redirectUrl: button.dataset.redirect
        });
      });
    });
  };

  window.FrogzzPayment = { open: openPayment, check: checkStatus };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind());
  else bind();
})();
