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
    .fzpay-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,12,30,.72);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px}
    .fzpay-overlay.show{display:flex}
    .fzpay-box{width:min(470px,100%);max-height:93vh;overflow:auto;background:#fff;border:1px solid #ece8f8;border-radius:26px;box-shadow:0 28px 80px rgba(21,14,49,.28);padding:22px;font-family:inherit;color:#19162a}
    .fzpay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.fzpay-head h3{margin:0;font-size:22px}.fzpay-close{border:0;background:#f2effb;width:40px;height:40px;border-radius:50%;font-size:24px;line-height:1;cursor:pointer;color:#171327}
    .fzpay-meta{display:grid;gap:8px;background:#f8f6ff;border-radius:18px;padding:14px;margin-bottom:16px}.fzpay-row{display:flex;justify-content:space-between;gap:15px;font-size:14px}.fzpay-row strong{font-weight:750;text-align:right;word-break:break-word}
    .fzpay-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:320px;padding:24px;text-align:center}.fzpay-spinner{width:52px;height:52px;border:5px solid #ece8fa;border-top-color:#171327;border-radius:50%;animation:fzpay-spin .75s linear infinite;margin-bottom:18px}@keyframes fzpay-spin{to{transform:rotate(360deg)}}.fzpay-loader strong{font-size:18px}.fzpay-loader span{margin-top:8px;color:#6a6479;font-size:14px;line-height:1.5}
    .fzpay-qr-wrap{display:none}.fzpay-qr-wrap.show{display:block}.fzpay-qr{display:block;width:100%;max-width:300px;aspect-ratio:1;margin:8px auto 14px;border-radius:18px;border:1px solid #ebe7f5;object-fit:contain;background:#fff}
    .fzpay-status{text-align:center;font-size:14px;line-height:1.6;margin:12px 0}.fzpay-status strong{display:block;font-size:16px}.fzpay-status-sub{color:#6a6479}
    .fzpay-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.fzpay-btn{appearance:none;border:0;border-radius:13px;padding:12px 14px;font-weight:750;cursor:pointer;text-decoration:none;text-align:center;font-size:14px}.fzpay-btn.primary{background:#171327;color:#fff}.fzpay-btn.secondary{background:#efecf8;color:#241f38}.fzpay-btn:disabled{opacity:.55;cursor:not-allowed}
    .fzpay-error{display:none;background:#fff1f1;border:1px solid #f2cece;color:#a22a2a;border-radius:14px;padding:12px;margin-top:12px;line-height:1.5}.fzpay-error.show{display:block}
    .fzpay-success-screen{display:none;text-align:center;padding:4px 0 2px}.fzpay-success-screen.show{display:block}
    .fzpay-check-wrap{width:100px;height:100px;margin:4px auto 16px;border-radius:50%;background:linear-gradient(145deg,#eafff1,#d8f9e5);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px rgba(24,139,71,.15);animation:fzpay-pop .45s ease-out}@keyframes fzpay-pop{0%{transform:scale(.55);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
    .fzpay-check{width:54px;height:54px;border-radius:50%;background:#20b15a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;box-shadow:0 8px 18px rgba(32,177,90,.28)}
    .fzpay-paid-title{font-size:25px;font-weight:850;color:#17602d;margin-bottom:5px}.fzpay-paid-sub{color:#6a6479;margin-bottom:16px}
    .fzpay-invoice{background:#fbfaff;border:1px solid #e9e3f6;border-radius:18px;padding:15px;text-align:left}.fzpay-invoice-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.fzpay-invoice-head strong{font-size:14px}.fzpay-badge{font-size:11px;font-weight:800;letter-spacing:.06em;padding:6px 9px;border-radius:999px;background:#e8faef;color:#17602d}.fzpay-invoice-row{display:flex;justify-content:space-between;gap:14px;margin:8px 0;font-size:13px}.fzpay-invoice-row span{color:#6a6479}.fzpay-invoice-row strong{text-align:right;word-break:break-word}.fzpay-trx{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1eef9;padding:3px 6px;border-radius:7px;font-size:12px}
    .fzpay-saved{margin-top:12px;background:#f7f5fe;border-radius:12px;padding:10px 12px;font-size:12px;color:#5e5870;line-height:1.5;text-align:center}.fzpay-saved strong{color:#241f38}
    .fzpay-copy{margin-top:10px;width:100%;border:0;border-radius:12px;background:#efecf8;padding:11px;font-weight:750;cursor:pointer;color:#241f38}.fzpay-copy:disabled{opacity:.5}
    .fzpay-manual{font-size:12px;color:#6a6479;text-align:center;margin-top:10px}.fzpay-hidden{display:none!important}
    @media(max-width:520px){.fzpay-actions{grid-template-columns:1fr}.fzpay-box{padding:18px;border-radius:21px}.fzpay-paid-title{font-size:23px}}
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
        <span>Tunggu sebentar, QRIS sedang dibuat. QRIS akan tampil setelah transaksi berhasil dibuat.</span>
      </div>

      <div id="fzpay-qr-wrap" class="fzpay-qr-wrap">
        <img id="fzpay-qr" class="fzpay-qr" alt="QRIS Pembayaran">
        <div id="fzpay-status" class="fzpay-status"><strong>Menunggu pembayaran</strong><span class="fzpay-status-sub">Silakan scan QRIS.</span></div>
        <div id="fzpay-error" class="fzpay-error"></div>
        <div class="fzpay-actions">
          <button id="fzpay-check" class="fzpay-btn secondary" type="button">↻ Cek Status</button>
          <button id="fzpay-cancel" class="fzpay-btn primary" type="button">Tutup</button>
        </div>
        <div class="fzpay-manual">Status otomatis dicek setiap 3 detik. Tombol “Cek Status” dapat dipakai kapan saja.</div>
      </div>

      <div id="fzpay-success-screen" class="fzpay-success-screen">
        <div class="fzpay-check-wrap"><div class="fzpay-check">✓</div></div>
        <div class="fzpay-paid-title">Pembayaran Berhasil</div>
        <div class="fzpay-paid-sub">Invoice kamu sudah lunas dan tercatat.</div>
        <div class="fzpay-invoice">
          <div class="fzpay-invoice-head"><strong>INVOICE FROGZZSHOP</strong><span class="fzpay-badge">LUNAS</span></div>
          <div class="fzpay-invoice-row"><span>Produk</span><strong id="fzpay-paid-product">-</strong></div>
          <div class="fzpay-invoice-row"><span>Harga</span><strong id="fzpay-paid-base">-</strong></div>
          <div class="fzpay-invoice-row"><span>Total dibayar</span><strong id="fzpay-paid-total">-</strong></div>
          <div class="fzpay-invoice-row"><span>ID TRX Depo</span><strong id="fzpay-paid-trx" class="fzpay-trx">-</strong></div>
          <div class="fzpay-invoice-row"><span>Invoice FrogzzShop</span><strong id="fzpay-paid-frog-invoice">-</strong></div>
          <div class="fzpay-invoice-row"><span>Invoice XS-Pedia</span><strong id="fzpay-paid-invoice">-</strong></div>
          <div class="fzpay-invoice-row"><span>Waktu</span><strong id="fzpay-paid-time">-</strong></div>
        </div>
        <div class="fzpay-saved">💾 <strong>ID TRX Depo sudah disimpan di perangkat ini.</strong><br>Simpan ID tersebut bila perlu untuk referensi transaksi.</div>
        <button id="fzpay-copy" class="fzpay-copy" type="button">📋 Salin ID TRX Depo</button>
        <div class="fzpay-actions"><button id="fzpay-continue" class="fzpay-btn primary" type="button">Lanjut ke Produk</button><button id="fzpay-done" class="fzpay-btn secondary" type="button">Tutup</button></div>
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
    error: overlay.querySelector('#fzpay-error'),
    check: overlay.querySelector('#fzpay-check'),
    cancel: overlay.querySelector('#fzpay-cancel'),
    successScreen: overlay.querySelector('#fzpay-success-screen'),
    paidProduct: overlay.querySelector('#fzpay-paid-product'),
    paidBase: overlay.querySelector('#fzpay-paid-base'),
    paidTotal: overlay.querySelector('#fzpay-paid-total'),
    paidTrx: overlay.querySelector('#fzpay-paid-trx'),
    paidFrogInvoice: overlay.querySelector('#fzpay-paid-frog-invoice'),
    paidInvoice: overlay.querySelector('#fzpay-paid-invoice'),
    paidTime: overlay.querySelector('#fzpay-paid-time'),
    copy: overlay.querySelector('#fzpay-copy'),
    cont: overlay.querySelector('#fzpay-continue'),
    done: overlay.querySelector('#fzpay-done'),
    close: overlay.querySelector('.fzpay-close')
  };

  let pollTimer = null;
  let current = null;
  let checkInFlight = false;
  let expiredAt = 0;
  let completed = false;
  let redirectTimer = null;

  const clearPoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const clearRedirect = () => {
    if (redirectTimer) clearTimeout(redirectTimer);
    redirectTimer = null;
  };

  const close = () => {
    clearPoll();
    clearRedirect();
    current = null;
    checkInFlight = false;
    completed = false;
    overlay.classList.remove('show');
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

  const saveTransaction = ({ id, product, amount, total, invoice, paidAt }) => {
    try {
      const key = 'frogzzshop_transactions';
      const old = JSON.parse(localStorage.getItem(key) || '[]');
      const entry = { id, product, amount, total, invoice: invoice || '', paidAt };
      const filtered = old.filter((item) => item && item.id !== id);
      filtered.unshift(entry);
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 10)));
      localStorage.setItem('frogzzshop_last_trx_depo', id);
    } catch (error) {
      console.warn('Gagal menyimpan transaksi lokal:', error);
    }
  };

  async function markPaid(detail) {
    if (!current || completed) return;
    completed = true;
    clearPoll();

    const paidAmount = Number(detail.total_amount || detail.paid_amount || detail.amount || current.totalAmount || current.amount);
    const invoice = String(detail.invoice || current.invoice || '-');
    const invoiceId = String(detail.invoice_id || current.invoiceId || '');
    current.invoiceId = invoiceId;

    const paidAt = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'medium'
    });

    el.qr.removeAttribute('src');
    el.qrWrap.classList.remove('show');
    el.loader.classList.add('fzpay-hidden');
    el.successScreen.classList.add('show');
    el.paidProduct.textContent = current.product;
    el.paidBase.textContent = money(current.amount);
    el.paidTotal.textContent = money(paidAmount);
    el.paidTrx.textContent = current.id;
    el.paidFrogInvoice.textContent = invoiceId || '-';
    el.paidInvoice.textContent = invoice || '-';
    el.paidTime.textContent = paidAt;
    el.copy.dataset.trx = current.id;
    el.cont.onclick = () => { window.location.href = current.redirectUrl; };

    saveTransaction({
      id: current.id,
      product: current.product,
      amount: current.amount,
      total: paidAmount,
      invoice,
      invoiceId,
      paidAt
    });

    // Redirect otomatis setelah invoice sukses sempat terbaca.
    redirectTimer = setTimeout(() => {
      window.location.href = current.redirectUrl;
    }, 3500);
  }

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
      const query = new URLSearchParams({
        id: current.id,
        product: current.product,
        amount: String(current.amount),
        t: Date.now()
      });
      const response = await fetch(`${API.status}?${query.toString()}`, {
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
        await markPaid(detail);
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
    clearRedirect();
    current = { product: product || 'Order', amount, totalAmount: amount, redirectUrl, id: '' };
    completed = false;
    expiredAt = 0;

    el.title.textContent = 'Pembayaran QRIS';
    el.product.textContent = current.product;
    el.base.textContent = money(amount);
    el.total.textContent = '-';
    el.trx.textContent = '-';
    el.expired.textContent = 'Membuat QRIS...';
    el.qr.removeAttribute('src');
    el.loader.classList.remove('fzpay-hidden');
    el.qrWrap.classList.remove('show');
    el.successScreen.classList.remove('show');
    el.check.disabled = true;
    clearError();
    overlay.classList.add('show');

    try {
      const response = await fetch(API.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ product: current.product, amount, redirectUrl })
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
        product: current.product,
        amount,
        totalAmount: createdAmount,
        redirectUrl: qris.redirect_url || redirectUrl,
        id: trxId,
        invoice: qris.invoice || ''
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

      await checkStatus(false);
      if (!completed) pollTimer = setInterval(() => checkStatus(false), 3000);
    } catch (error) {
      clearPoll();
      el.loader.classList.add('fzpay-hidden');
      el.qrWrap.classList.add('show');
      showError(error.message || 'Tidak dapat membuat QRIS.');
      setStatus('❌ Gagal membuat pembayaran', 'Silakan tutup lalu coba order kembali.');
      el.check.disabled = false;
    }
  }

  el.close.addEventListener('click', close);
  el.cancel.addEventListener('click', close);
  el.done.addEventListener('click', close);
  el.check.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    checkStatus(true);
  });
  el.copy.addEventListener('click', async () => {
    const trx = el.copy.dataset.trx || '';
    if (!trx) return;
    try {
      await navigator.clipboard.writeText(trx);
      el.copy.textContent = '✅ ID TRX berhasil disalin';
      setTimeout(() => { el.copy.textContent = '📋 Salin ID TRX Depo'; }, 1800);
    } catch {
      el.copy.textContent = trx;
    }
  });
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (!current || completed || Date.now() >= expiredAt) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('show')) close();
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
