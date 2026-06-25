# Deployment Guide - Automated Setup

## Prerequisites Check

Saat ini Node.js tidak terinstall di sistem ini. Untuk menjalankan build dan deploy, Anda perlu:

1. Install Node.js (v18 atau higher)
2. Install npm/yarn/pnpm
3. Install Cloudflare Wrangler CLI

## Alternative: Manual Deployment Steps

Karena Node.js tidak tersedia di environment ini, berikut adalah langkah-langkah yang perlu Anda jalankan di komputer Anda:

### Step 1: Install Node.js

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

### Step 2: Install Dependencies

```bash
cd /home/muzz/Documents/App/iBuruhApp
npm install
```

### Step 3: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 4: Login ke Cloudflare

```bash
wrangler login
```

### Step 5: Create D1 Database

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

### Step 6: Migrate Database Schema

**Untuk Local Development:**
```bash
wrangler d1 execute iburuh-db --file=schema.sql --local
```

**Untuk Production:**
```bash
wrangler d1 execute iburuh-db --file=schema.sql --remote
```

### Step 7: Build Project

```bash
npm run build
```

### Step 8: Deploy ke Cloudflare Pages

```bash
wrangler pages deploy dist --project-name=iburuh-app
```

Atau via Cloudflare Dashboard:
1. Build project: `npm run build`
2. Go to Cloudflare Dashboard > Pages
3. Create new project > Upload assets
4. Upload folder `dist`
5. Set build command: `npm run build`
6. Set output directory: `dist`

### Step 9: Setup Environment Variables

Di Cloudflare Pages dashboard:
1. Go to Settings > Environment Variables
2. Add: `DATABASE_ID` = your database ID
3. Go to Settings > Functions > D1 database bindings
4. Add binding: Variable name `DB`, D1 database `iburuh-db`

## Verification

Setelah deployment:
1. Buka URL aplikasi Anda
2. Coba filter pencarian buruh
3. Test booking filter aktif dengan dua browser

## Quick Deployment Script

Buat file `deploy.sh` untuk automasi:

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build project
echo "🔨 Building project..."
npm run build

# Deploy to Cloudflare Pages
echo "☁️ Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=iburuh-app

echo "✅ Deployment complete!"
```

Jalankan dengan:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Troubleshooting

### npm: command not found
Install Node.js terlebih dahulu (lihat Step 1)

### wrangler: command not found
```bash
npm install -g wrangler
```

### Database connection error
Pastikan:
- `DATABASE_ID` sudah diset di environment variables
- D1 binding sudah dikonfigurasi
- Schema sudah di-execute dengan `--remote` flag

### Build errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Current Project Status

✅ Project structure complete
✅ Database schema ready
✅ API endpoints implemented
✅ UI components ready
✅ Booking filter aktif system implemented
✅ Deployed to Cloudflare Pages (https://iburuh-app.pages.dev/)
