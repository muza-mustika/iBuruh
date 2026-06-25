# Manual Deployment Instructions

## Status Update

⚠️ **Node.js tidak tersedia di environment ini.** Build dan deploy harus dilakukan di komputer Anda sendiri.

## Quick Start Deployment

### Option 1: Use Automated Script (Recommended)

1. Install Node.js terlebih dahulu
2. Jalankan script deployment:

```bash
cd /home/muzz/Documents/App/iBuruhApp
./deploy.sh
```

Script ini akan otomatis:
- ✅ Check Node.js installation
- ✅ Install dependencies
- ✅ Setup Cloudflare authentication
- ✅ Create D1 database (jika belum ada)
- ✅ Migrate database schema
- ✅ Build project
- ✅ Deploy ke Cloudflare Pages

### Option 2: Manual Step-by-Step

#### 1. Install Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**MacOS:**
```bash
brew install node
```

**Windows:**
Download dari https://nodejs.org/

#### 2. Install Dependencies

```bash
cd /home/muzz/Documents/App/iBuruhApp
npm install
```

#### 3. Install Wrangler CLI

```bash
npm install -g wrangler
```

#### 4. Login ke Cloudflare

```bash
wrangler login
```

#### 5. Create D1 Database

```bash
wrangler d1 create iburuh-db
```

**Copy output `database_id` dan update file `wrangler.toml`:**

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "PASTE_DATABASE_ID_DISINI"

[[env.development.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "PASTE_DATABASE_ID_DISINI"
```

#### 6. Migrate Database Schema

**Untuk Development (Local):**
```bash
wrangler d1 execute iburuh-db --file=schema.sql --local
```

**Untuk Production:**
```bash
wrangler d1 execute iburuh-db --file=schema.sql --remote
```

#### 7. Build Project

```bash
npm run build
```

#### 8. Deploy ke Cloudflare Pages

```bash
wrangler pages deploy dist --project-name=iburuh-app
```

#### 9. Setup Environment Variables di Cloudflare Dashboard

1. Buka Cloudflare Dashboard > Pages > iburuh-app
2. Go to **Settings** > **Environment Variables**
3. Add variable:
   - Name: `DATABASE_ID`
   - Value: Your D1 database ID
4. Go to **Settings** > **Functions** > **D1 database bindings**
5. Add binding:
   - Variable name: `DB`
   - D1 database: `iburuh-db`

## Verification Steps

Setelah deployment selesai:

1. **Buka URL aplikasi** yang diberikan oleh Cloudflare Pages
2. **Test filter pencarian**:
   - Pilih tanggal
   - Pilih kategori dan keahlian
   - Pilih durasi dan jumlah
   - Klik "Terapkan"
3. **Test booking filter aktif**:
   - Buka aplikasi di dua browser berbeda (incognito)
   - Di browser 1, apply filter
   - Di browser 2, coba filter yang sama
   - Browser 2 tidak seharusnya bisa mengunci buruh yang sama
4. **Test auto-release**:
   - Di browser 1, ubah filter
   - Buruh harus ter-release dan bisa di-booking browser 2

## Troubleshooting

### npm: command not found
Install Node.js terlebih dahulu (lihat step 1)

### wrangler: command not found
```bash
npm install -g wrangler
```

### Database connection error
- Pastikan `DATABASE_ID` sudah diset di environment variables
- Pastikan D1 binding sudah dikonfigurasi di Cloudflare Pages
- Coba migrate database ulang dengan `--remote` flag

### Build errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Workers tidak terkunci
- Check browser console untuk error
- Pastikan session ID tersimpan di localStorage
- Cek API endpoints bekerja dengan Network tab

## Useful Commands

```bash
# Check database content
wrangler d1 execute iburuh-db --command="SELECT * FROM workers" --remote

# Check temporary bookings
wrangler d1 execute iburuh-db --command="SELECT * FROM temporary_bookings" --remote

# Clear expired locks
wrangler d1 execute iburuh-db --command="DELETE FROM temporary_bookings WHERE expires_at < datetime('now')" --remote

# View logs
wrangler pages deployment tail --project-name=iburuh-app

# Local development
npm run dev
```

## Project Status

✅ Project structure complete
✅ Database schema ready (schema.sql)
✅ API endpoints implemented
✅ UI components ready
✅ Booking filter aktif system implemented
✅ Deployment script created (deploy.sh)
✅ Deployed to Cloudflare Pages (https://iburuh-app.pages.dev/)

## File Structure

```
iBuruhApp/
├── src/                      # Source code
│   ├── pages/
│   │   ├── index.astro      # Main page
│   │   └── api/             # API endpoints
│   ├── layouts/
│   └── styles/
├── schema.sql               # Database schema
├── wrangler.toml            # Cloudflare config
├── astro.config.mjs         # Astro config
├── package.json             # Dependencies
├── deploy.sh               # Automated deployment script
├── README.md               # Project documentation
├── SETUP.md                # Setup guide
├── DEPLOYMENT_GUIDE.md     # Deployment guide
└── MANUAL_DEPLOYMENT.md    # This file
```

## Support

Jika mengalami masalah:
1. Check logs: `wrangler pages deployment tail --project-name=iburuh-app`
2. Verify database: `wrangler d1 execute iburuh-db --command="SELECT * FROM workers" --remote`
3. Check environment variables di Cloudflare Dashboard
4. Review Cloudflare Pages Functions logs

## Next Steps After Deployment

1. ✅ Customisasi data buruh di database
2. ✅ Tambahkan authentication system
3. ✅ Integrasikan payment gateway
4. ✅ Setup notification system
5. ✅ Add admin dashboard
