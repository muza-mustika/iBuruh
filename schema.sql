-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  skill_category TEXT NOT NULL,
  skill_subcategory TEXT,
  hourly_rate INTEGER NOT NULL,
  phone TEXT,
  photo_url TEXT,
  rating REAL DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  session_id TEXT NOT NULL, -- To track filter sessions
  filter_hash TEXT NOT NULL, -- Hash of the filter parameters
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id),
  UNIQUE(worker_id, booking_date, start_time, end_time)
);

-- Temporary bookings for filter locking
CREATE TABLE IF NOT EXISTS temporary_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  filter_hash TEXT NOT NULL,
  filter_params TEXT NOT NULL, -- JSON string of filter parameters
  locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(id),
  UNIQUE(worker_id, session_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workers_skill ON workers(skill_category, skill_subcategory);
CREATE INDEX IF NOT EXISTS idx_workers_available ON workers(available);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_temp_bookings_worker ON temporary_bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_temp_bookings_session ON temporary_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_temp_bookings_expires ON temporary_bookings(expires_at);

-- Insert sample workers
INSERT INTO workers (name, skill_category, skill_subcategory, hourly_rate, phone, rating, total_jobs) VALUES
('Budi Santoso', 'Konstruksi', 'Tukang Batu', 75000, '081234567890', 4.5, 23),
('Ahmad Yani', 'Konstruksi', 'Tukang Kayu', 80000, '081234567891', 4.7, 31),
('Siti Aminah', 'Kebersihan', 'Cleaning Service', 50000, '081234567892', 4.3, 18),
('Rahmat Hidayat', 'Konstruksi', 'Tukang Cat', 70000, '081234567893', 4.6, 27),
('Dewi Kartika', 'Kebersihan', 'Laundry', 45000, '081234567894', 4.4, 15),
('Eko Prasetyo', 'Konstruksi', 'Tukang Besi', 85000, '081234567895', 4.8, 35),
('Fanny Wijaya', 'Kebersihan', 'Baby Sitter', 60000, '081234567896', 4.5, 22),
('Gunawan', 'Konstruksi', 'Tukang Listrik', 90000, '081234567897', 4.9, 42),
('Hani Melati', 'Kebersihan', 'Lansia Care', 65000, '081234567898', 4.6, 19),
('Indra Lesmana', 'Konstruksi', 'Tukang AC', 95000, '081234567899', 4.7, 29);
