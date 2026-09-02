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
