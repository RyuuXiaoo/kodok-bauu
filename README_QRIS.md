# FrogzzShop — QRIS otomatis XS-Pedia

Alur order sekarang: klik order → server Vercel membuat QRIS XS-Pedia → halaman mengecek status otomatis setiap 3 detik → setelah `success`, muncul konfirmasi nominal dan pengguna diarahkan ke link tujuan order. Tombol **Cek Status** tersedia untuk pengecekan manual.

## Environment

Isi `.env` untuk local development:

```env
XS_PEDIA_APIKEY=ISI_API_KEY_XS_PEDIA
XS_PEDIA_BASE_URL=https://xs-pedia.my.id
```

Jangan taruh API key langsung di JavaScript frontend. Untuk Vercel, masukkan `XS_PEDIA_APIKEY` melalui **Project → Settings → Environment Variables**, lalu redeploy. Vercel menyediakan environment variables untuk memisahkan secret dari source code.

## Vercel

Project ini berupa static HTML + Vercel Functions di folder `/api`, sehingga dapat dideploy sebagai satu project. Endpoint yang digunakan:

- `POST /api/create-payment`
- `GET /api/check-payment?id=TRANSACTION_ID`

Tidak ada API key XS-Pedia yang dikirim ke browser; pemanggilan ke XS-Pedia dilakukan dari function server.

## Produk tes

Homepage sudah ditambahkan produk **Produk Tes** seharga **Rp10** untuk menguji pembuatan QRIS dan polling status. Pastikan akun/API XS-Pedia kamu memang mengizinkan nominal tersebut sebelum melakukan pengujian.

## Catatan redirect

Setelah pembayaran berhasil, frontend akan mengarahkan user ke Discord atau halaman tujuan yang disimpan pada tombol order. Tombol support/footer yang bukan order tidak dipaksa masuk pembayaran.

## Telegram Owner Notification
Tambahkan environment variable berikut di Vercel:

- `TELEGRAM_BOT_TOKEN` = token bot dari @BotFather
- `TELEGRAM_OWNER_CHAT_ID` = ID chat owner / grup tujuan notifikasi
- `FROGZZ_NOTIFY_SECRET` = secret acak panjang (disarankan 32+ karakter). Bila kosong, sistem memakai `XS_PEDIA_APIKEY` sebagai fallback.

Setelah pembayaran berstatus sukses, website menampilkan invoice sukses, menyimpan ID TRX Depo di localStorage, lalu mengirim invoice ringkas ke Telegram owner melalui Telegram Bot API. Bot menggunakan endpoint HTTPS Bot API `sendMessage`. Pastikan owner sudah memulai chat dengan bot atau bot memiliki akses ke grup tujuan.
