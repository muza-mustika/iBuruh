# iBuruh - Aplikasi Pemesanan Jasa Buruh

Aplikasi full stack untuk pemesanan jasa buruh dengan fitur booking filter aktif menggunakan Astro, Cloudflare Pages Worker, dan D1 database.

## Fitur Utama

- **Pencarian Buruh**: Filter berdasarkan kategori, keahlian, tanggal, durasi, dan jumlah
- **Booking Filter Aktif**: Buruh yang muncul dalam hasil filter dikunci untuk session user saat ini
- **Auto-Release**: Booking otomatis dilepaskan saat filter berubah atau dibatalkan
- **Real-time Availability**: Menampilkan buruh yang benar-benar tersedia (tidak sedang dipesan)
- **Session Management**: Setiap user memiliki session unik untuk melacak booking sementara

## Tech Stack

- **Frontend**: Astro dengan Cloudflare adapter
- **Backend**: Cloudflare Pages Worker
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: CSS dengan custom design system

## Setup dan Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Cloudflare D1 Database

Buat database D1 di Cloudflare:

```bash
wrangler d1 create iburuh-db
```

Copy database ID yang muncul dan update di `wrangler.toml`:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[env.development.d1_databases]]
binding = "DB"
database_name = "iburuh-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Setup Database Schema

Execute schema.sql untuk membuat tabel dan data sample:

```bash
wrangler d1 execute iburuh-db --file=schema.sql --local
```

Untuk production:

```bash
wrangler d1 execute iburuh-db --file=schema.sql --remote
```

### 4. Development

Jalankan development server:

```bash
npm run dev
```

### 5. Build untuk Production

```bash
npm run build
```

### 6. Deploy ke Cloudflare Pages

```bash
npm run build
wrangler pages deploy dist
```

## API Endpoints

### GET /api/workers
Mencari buruh yang tersedia berdasarkan filter.

Query Parameters:
- `date`: Tanggal booking (YYYY-MM-DD)
- `skill_category`: Kategori keahlian
- `skill_subcategory`: Sub-kategori keahlian
- `start_time`: Jam mulai (HH:MM)
- `duration`: Durasi dalam jam
- `jumlah`: Jumlah buruh yang dibutuhkan

### POST /api/workers/lock
Mengunci buruh untuk session tertentu.

Request Body:
```json
{
  "session_id": "session_123",
  "filter_hash": "abc123",
  "filter_params": { ... },
  "worker_ids": [1, 2, 3]
}
```

### POST /api/workers/release
Melepaskan kunci buruh.

Request Body:
```json
{
  "session_id": "session_123",
  "filter_hash": "abc123"
}
```

### POST /api/bookings
Membuat booking permanen.

Request Body:
```json
{
  "worker_id": 1,
  "session_id": "session_123",
  "booking_date": "2024-01-15",
  "start_time": "08:00",
  "end_time": "16:00",
  "duration_hours": 8,
  "total_price": 600000,
  "filter_hash": "abc123"
}
```

## Database Schema

### workers
- `id`: Primary key
- `name`: Nama buruh
- `skill_category`: Kategori keahlian
- `skill_subcategory`: Sub-kategori keahlian
- `hourly_rate`: Tarif per jam
- `phone`: Nomor telepon
- `photo_url`: URL foto
- `rating`: Rating buruh
- `total_jobs`: Total jobs selesai
- `available`: Status ketersediaan

### bookings
- `id`: Primary key
- `worker_id`: Foreign key ke workers
- `user_id`: ID user yang memesan
- `booking_date`: Tanggal booking
- `start_time`: Jam mulai
- `end_time`: Jam selesai
- `duration_hours`: Durasi dalam jam
- `total_price`: Total harga
- `status`: Status booking (pending, confirmed, completed, cancelled)
- `session_id`: ID session saat booking
- `filter_hash`: Hash filter yang digunakan

### temporary_bookings
- `id`: Primary key
- `worker_id`: Foreign key ke workers
- `user_id`: ID user
- `session_id`: ID session
- `filter_hash`: Hash filter
- `filter_params`: Parameter filter (JSON)
- `locked_at`: Waktu penguncian
- `expires_at`: Waktu kadaluarsa (15 menit)

## Cara Kerja Booking Filter Aktif

1. **Session Creation**: Setiap user mendapatkan session ID unik yang disimpan di localStorage
2. **Filter Application**: Saat user menerapkan filter, sistem mencari buruh yang tersedia
3. **Worker Locking**: Buruh yang ditemukan dikunci di tabel `temporary_bookings` dengan session ID user
4. **Conflict Prevention**: User lain tidak bisa mengunci buruh yang sudah dikunci oleh session lain
5. **Auto-Release**: 
   - Saat user mengubah filter, lock dengan filter hash lama dilepaskan
   - Saat user membatalkan, semua lock untuk session tersebut dilepaskan
   - Lock otomatis kadaluarsa setelah 15 menit
6. **Permanent Booking**: Saat user checkout, booking permanen dibuat dan lock sementara dilepaskan

## Environment Variables

- `DATABASE_ID`: Cloudflare D1 database ID

## License

MIT
