(function () {
  'use strict';

  const API = {
    create: '/api/create-payment',
    status: '/api/check-payment'
  };

  const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const styles = `
    .fzpay-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,12,30,.72);backdrop-filter:blur(7px);display:none;align-items:center;justify-content:center;padding:18px}
    .fzpay-overlay.show{display:flex}
    .fzpay-box{width:min(460px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #ece8f8;border-radius:24px;box-shadow:0 28px 80px rgba(21,14,49,.28);padding:22px;font-family:inherit;color:#19162a}
    .fzpay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.fzpay-head h3{margin:0;font-size:20px}
    .fzpay-close{border:0;background:#f2effb;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer}
    .fzpay-meta{display:grid;gap:7px;background:#f8f6ff;border-radius:16px;padding:13px;margin-bottom:16px}.fzpay-row{display:flex;justify-content:space-between;gap:15px;font-size:14px}.fzpay-row strong{font-weight:700;text-align:right;word-break:break-all}
    .fzpay-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:310px;padding:20px;text-align:center}.fzpay-spinner{width:48px;height:48px;border:5px solid #ece8fa;border-top-color:#171327;border-radius:50%;animation:fzpay-spin .8s linear infinite;margin-bottom:18px}@keyframes fzpay-spin{to{transform:rotate(360deg)}}.fzpay-loader strong{font-size:18px}.fzpay-loader span{margin-top:7px;color:#6a6479;font-size:14px}
    .fzpay-qr-wrap{display:none}.fzpay-qr-wrap.show{display:block}.fzpay-qr{display:block;width:100%;max-width:300px;aspect-ratio:1;margin:8px auto 14px;border-radius:18px;border:1px solid #ebe7f5;object-fit:contain;background:#fff}
    .fzpay-status{text-align:center;font-size:14px;line-height:1.6;margin:12px 0}.fzpay-status strong{display:block;font-size:16px}.fzpay-status-sub{color:#6a6479}
    .fzpay-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.fzpay-btn{appearance:none;border:0;border-radius:12px;padding:12px 14px;font-weight:700;cursor:pointer;text-decoration:none;text-align:center;font-size:14px}.fzpay-btn.primary{background:#171327;color:#fff}.fzpay-btn.secondary{background:#efecf8;color:#241f38}.fzpay-btn:disabled{opacity:.55;cursor:not-allowed}
    .fzpay-success{display:none;background:#eefbf2;border:1px solid #cdeed7;color:#17602d;border-radius:14px;padding:12px;margin-top:12px}.fzpay-success.show{display:block}
    .fzpay-error{display:none;background:#fff1f1;border:1px solid #f2cece;color:#a22a2a;border-radius:14px;padding:12px;margin-top:12px}.fzpay-error.show{display:block}
    .fzpay-manual{font-size:12px;color:#6a6479;text-align:center;margin-top:10px}.fzpay-hidden{display:none!important}
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
        <div class="fzpay-row"><span>Harga produk</span><strong id="fzpay-base">-</strong></div>
        <div class="fzpay-row"><span>Total bayar</span><strong id="fzpay-total">-</strong></div>
        <div class="fzpay-row"><span>ID TRX Depo</span><strong id="fzpay-trx">-</strong></div>
        <div class="fzpay-row"><span>Batas pembayaran</span><strong id="fzpay-expired">-</strong></div>
      </div>

      <div id="fzpay-loader" class="fzpay-loader">
        <div class="fzpay-spinner" aria-hidden="true"></div>
        <strong>Membuat QRIS...</strong>
        <span>Tunggu sebentar, QRIS sedang dibuat.</span>
      </div>

      <div id="fzpay-qr-wrap" class="fzpay-qr-wrap">
        <img id="fzpay-qr" class="fzpay-qr" alt="QRIS Pembayaran">
        <div id="fzpay-status" class="fzpay-status"><strong>Menunggu pembayaran</strong><span class="fzpay-status-sub">Silakan scan QRIS.</span></div>
        <div id="fzpay-success" class="fzpay-success"></div>
        <div id="fzpay-error" class="fzpay-error"></div>
        <div class="fzpay-actions">
          <button id="fzpay-check" class="fzpay-btn secondary" type="button">↻ Cek Status</button>
          <a id="fzpay-continue" class="fzpay-btn primary" href="#" target="_blank" rel="noopener noreferrer" style="display:none">Lanjut ke tujuan</a>
        </div>
        <div class="fzpay-manual">Status otomatis dicek setiap 3 detik. Tombol “Cek Status” dapat dipakai kapan saja.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const el = {
    overlay,
    title: overlay.querySelector('#fzpay-title'),
    product: overlay.querySelector('#fzpay-product'),
    base: overlay.querySelector('#fzpay-base'),
    total: overlay.querySelector('#fzpay-total'),
    trx: overlay.querySelector('#fzpay-trx'),
    expired: overlay.querySelector('#fzpay-expired'),
    loader: overlay.querySelector('#fzpay-loader'),
    qrWrap: overlay.querySelector('#fzpay-qr-wrap'),
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
  let checkInFlight = false;
  let expiredAt = 0;
  let completed = false;

  const clearPoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const close = () => {
    clearPoll();
    current = null;
    checkInFlight = false;
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
    el.status.innerHTML = `<strong>${escapeHtml(title)}</strong><span class="fzpay-status-sub">${escapeHtml(detail)}</span>`;
  };

  const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

  async function checkStatus(manual = false) {
    if (!current || completed || checkInFlight) return;

    if (Date.now() >= expiredAt) {
      clearPoll();
      setStatus('⏰ Pembayaran kedaluwarsa', 'Waktu pembayaran sudah habis. Silakan buat transaksi baru.');
      el.check.disabled = false;
      return;
    }

    checkInFlight = true;
    if (manual) {
      el.check.disabled = true;
      setStatus('🔄 Mengecek pembayaran...', 'Menghubungi XS-Pedia, mohon tunggu.');
    }
    clearError();

    try {
      const response = await fetch(`${API.status}?id=${encodeURIComponent(current.id)}&t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(data.message || `Gagal mengecek status (${response.status})`);
      }

      const detail = data.data || {};
      const status = normalizeStatus(detail.status || detail.transaction_status || detail.payment_status);

      if (['success', 'paid', 'completed', 'berhasil'].includes(status)) {
        completed = true;
        clearPoll();
        const paidAmount = Number(detail.total_amount || detail.paid_amount || detail.amount || current.totalAmount);
        el.success.innerHTML = `✅ <strong>Sudah bayar.</strong><br>Nominal pembayaran: <strong>${escapeHtml(money(paidAmount))}</strong><br>ID TRX Depo: <strong>${escapeHtml(current.id)}</strong>`;
        el.success.classList.add('show');
        setStatus('✅ Pembayaran berhasil', `Sudah terkonfirmasi. Mengarahkan ke tujuan order...`);
        el.cont.href = current.redirectUrl;
        el.cont.style.display = 'block';
        el.check.disabled = true;
        setTimeout(() => { window.location.href = current.redirectUrl; }, 1500);
        return;
      }

      if (['cancel', 'cancelled', 'failed', 'expired', 'canceled'].includes(status)) {
        clearPoll();
        setStatus('⚠️ Transaksi tidak dapat dilanjutkan', `Status pembayaran: ${status}.`);
        el.check.disabled = false;
        return;
      }

      setStatus('⏳ Menunggu pembayaran', 'QRIS belum menerima pembayaran.');
    } catch (error) {
      // Error sementara tidak menghentikan polling. Tombol manual tetap dapat digunakan.
      showError(error.message || 'Status pembayaran belum bisa dicek.');
      setStatus('🔄 Menunggu koneksi', 'Pengecekan otomatis akan dicoba lagi dalam 3 detik.');
    } finally {
      checkInFlight = false;
      if (!completed && manual) el.check.disabled = false;
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
    expiredAt = 0;
    el.title.textContent = 'Pembayaran QRIS';
    el.product.textContent = product || 'Order';
    el.base.textContent = money(amount);
    el.total.textContent = '-';
    el.trx.textContent = '-';
    el.expired.textContent = 'Membuat QRIS...';
    el.qr.removeAttribute('src');
    el.success.classList.remove('show');
    el.success.textContent = '';
    clearError();
    el.qrWrap.classList.remove('show');
    el.loader.classList.remove('fzpay-hidden');
    el.check.disabled = true;
    el.cont.style.display = 'none';
    el.overlay.classList.add('show');

    try {
      const response = await fetch(API.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ product, amount, redirectUrl })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) {
        throw new Error(data.message || `Gagal membuat QRIS (${response.status})`);
      }

      const qris = data.data || {};
      const trxId = String(qris.id || qris.invoice || qris.transaction_id || '').trim();
      if (!trxId || !qris.qr_image) {
        throw new Error('Respons XS-Pedia tidak berisi ID transaksi atau QR image.');
      }

      const createdAmount = Number(qris.total_amount || qris.amount || amount);
      current = {
        id: trxId,
        totalAmount: createdAmount,
        redirectUrl: qris.redirect_url || redirectUrl
      };
      expiredAt = Number(qris.expires_at || (Date.now() + 15 * 60 * 1000));

      el.loader.classList.add('fzpay-hidden');
      el.qrWrap.classList.add('show');
      el.total.textContent = money(createdAmount);
      el.trx.textContent = trxId;
      el.expired.textContent = new Date(expiredAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      el.qr.src = qris.qr_image;
      setStatus('⏳ Menunggu pembayaran', 'Silakan scan QRIS. Pembayaran akan terdeteksi otomatis.');
      el.check.disabled = false;

      // Cek langsung sekali, lalu polling stabil setiap 3 detik.
      await checkStatus(false);
      if (!completed) pollTimer = setInterval(() => checkStatus(false), 3000);
    } catch (error) {
      clearPoll();
      el.loader.classList.add('fzpay-hidden');
      showError(error.message || 'Tidak dapat membuat QRIS.');
      el.qrWrap.classList.add('show');
      setStatus('❌ Gagal membuat pembayaran', 'Silakan tutup lalu coba order kembali.');
      el.check.disabled = false;
    }
  }

  el.close.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (!current || completed || Date.now() >= expiredAt) close();
  });
  el.check.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    checkStatus(true);
  });

  const bind = (root = document) => {
    root.querySelectorAll('[data-payment-order]').forEach((button) => {
      if (button.dataset.paymentBound === '1') return;
      button.dataset.paymentBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPayment({
          product: button.dataset.product || button.textContent.trim() || 'Order',
          amount: button.dataset.price,
          redirectUrl: button.dataset.redirect
        });
      });
    });
  };

  window.FrogzzPayment = { open: openPayment, check: () => checkStatus(true) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind());
  else bind();
})();
