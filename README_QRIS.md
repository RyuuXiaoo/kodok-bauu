# FrogzzShop — QRIS XS-Pedia + Telegram Owner Notification

Alur pembayaran:
1. Klik Pesan.
2. Loading membuat QRIS muncul terlebih dahulu.
3. Setelah QRIS berhasil dibuat, QR ditampilkan bersama ID TRX Depo.
4. Status dicek otomatis setiap 3 detik dan bisa dicek manual.
5. Saat sukses, QR diganti layar centang + invoice FrogzzShop.
6. Notifikasi owner Telegram dikirim dari server Vercel setelah pembayaran terverifikasi, sehingga tidak ikut batal ketika browser redirect.

## Konfigurasi

`api/config.js` sudah berisi fallback token Telegram dan chat ID yang diberikan pemilik project. Environment Variable tetap diprioritaskan, sehingga konfigurasi Vercel dapat menggantikannya.

Untuk XS-Pedia, isi `XS_PEDIA_APIKEY` di Vercel atau `.env` lokal.

> PENTING: `api/config.js` dan `.env` sekarang mengandung credential Telegram. Jangan upload project ini ke repository publik. Karena token bot sudah pernah dibagikan di chat, sebaiknya token dirotasi lewat BotFather setelah deployment/testing selesai.

## Struktur Order Terbaru
- `index.html` hanya menampilkan katalog dan mengarahkan ke halaman produk.
- `products/samphosting.html` menangani order + QRIS termasuk Produk Tes Rp10.
- `products/open-mp.html` menangani order + QRIS termasuk Produk Tes Rp10.
- `payment.js` tidak lagi dimuat oleh `index.html`.
