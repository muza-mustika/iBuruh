# Setup Guide - iBuruh App

## Prerequisites

- Node.js (v18 or higher)
- npm, yarn, atau pnpm
- Cloudflare account dengan Workers dan D1 enabled
- Wrangler CLI (`npm install -g wrangler`)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /home/muzz/Documents/App/iBuruhApp
npm install
```

### 2. Setup Cloudflare Authentication

Login ke Cloudflare:

```bash
wrangler login
```

### 3. Create D1 Database

Buat database D1 baru:

```bash
wrangler d1 create iburuh-db
```

Copy `database_id` yang muncul dan update file `wrangler.toml`:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"

[[env.development.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

### 4. Initialize Database Schema

Untuk development (local):

```bash
wrangler d1 execute iburuh-db --file=schema.sql --local
```

Untuk production:

```bash
wrangler d1 execute iburuh-db --file=schema.sql --remote
```

### 5. Development

Jalankan development server:

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:4321`

### 6. Build untuk Production

```bash
npm run build
```

### 7. Deploy ke Cloudflare Pages

#### Option A: Deploy dengan Wrangler

```bash
npm run build
wrangler pages deploy dist --project-name=iburuh-app
```

#### Option B: Deploy via Cloudflare Dashboard

1. Build project: `npm run build`
2. Go to Cloudflare Dashboard > Pages
3. Create new project > Upload assets
4. Upload folder `dist`
5. Set build command: `npm run build`
6. Set output directory: `dist`

### 8. Setup Environment Variables di Cloudflare Pages

Di Cloudflare Pages dashboard:

1. Go to your project > Settings > Environment Variables
2. Add variable:
   - Name: `DATABASE_ID`
   - Value: Your D1 database ID
3. Save changes

### 9. Bind D1 Database ke Pages Project

Di Cloudflare Pages dashboard:

1. Go to your project > Settings > Functions > D1 database bindings
2. Add binding:
   - Variable name: `DB`
   - D1 database: `iburuh-db`
3. Save changes

## Verifikasi Setup

Setelah deployment, cek:

1. Buka URL aplikasi Anda
2. Coba filter pencarian buruh
3. Pastikan API endpoints bekerja:
   - `/api/workers` - GET request
   - `/api/workers/lock` - POST request
   - `/api/workers/release` - POST request
   - `/api/bookings` - POST request

## Troubleshooting

### Database tidak terhubung

Pastikan:
- `DATABASE_ID` sudah diset di environment variables
- D1 binding sudah dikonfigurasi di Pages settings
- Schema sudah di-execute dengan `--remote` flag

### API endpoints tidak bekerja

Pastikan:
- Project sudah di-build dengan `npm run build`
- Output folder `dist` sudah di-deploy
- Functions sudah enabled di Cloudflare Pages

### Workers tidak terkunci

Pastikan:
- Session ID tersimpan di localStorage
- Filter hash di-generate dengan benar
- Temporary bookings table sudah dibuat

## Testing Booking Filter Aktif

1. Buka aplikasi di dua browser berbeda (incognito mode)
2. Di browser 1, apply filter untuk mencari buruh
3. Buruh yang muncul harus terkunci untuk session browser 1
4. Di browser 2, coba filter yang sama
5. Browser 2 tidak boleh bisa mengunci buruh yang sama
6. Di browser 1, ubah filter atau batalkan
7. Buruh harus otomatis ter-release dan bisa di-booking oleh browser 2

## Useful Commands

```bash
# Check D1 database content
wrangler d1 execute iburuh-db --command="SELECT * FROM workers" --remote

# Check temporary bookings
wrangler d1 execute iburuh-db --command="SELECT * FROM temporary_bookings" --remote

# Clear expired locks
wrangler d1 execute iburuh-db --command="DELETE FROM temporary_bookings WHERE expires_at < datetime('now')" --remote

# View logs
wrangler pages deployment tail --project-name=iburuh-app
```

## Next Steps

Setelah setup selesai:

1. Customisasi data buruh di database
2. Tambahkan authentication system
3. Integrasikan payment gateway
4. Setup notification system
5. Add admin dashboard
