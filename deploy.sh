#!/bin/bash

# Deployment Script for iBuruh App
# This script automates the build and deployment process

set -e  # Exit on error

echo "========================================"
echo "🚀 iBuruh App Deployment Script"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js first:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  MacOS: brew install node"
    echo "  Windows: Download from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

echo "✅ Wrangler version: $(wrangler --version)"
echo ""

# Check if logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Install dependencies
echo "📦 Installing project dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Check if database exists
echo "🗄️  Checking D1 database..."
if wrangler d1 list | grep -q "iburuh-db"; then
    echo "✅ Database 'iburuh-db' already exists"
else
    echo "⚠️  Database 'iburuh-db' not found"
    echo "Creating database..."
    wrangler d1 create iburuh-db
    echo ""
    echo "⚠️  IMPORTANT: Copy the database_id above and update wrangler.toml"
    echo "   Press Enter when you've updated wrangler.toml..."
    read
fi

# Get database ID from wrangler.toml
DB_ID=$(grep -A 2 "database_name = \"iburuh-db\"" wrangler.toml | grep "database_id" | cut -d'"' -f2)

if [ -z "$DB_ID" ] || [ "$DB_ID" = "PASTE_YOUR_DATABASE_ID_HERE" ] || [ "$DB_ID" = "" ]; then
    echo "❌ Database ID not set in wrangler.toml"
    echo "Please update the database_id in wrangler.toml first"
    exit 1
fi

echo "✅ Database ID: $DB_ID"
echo ""

# Migrate database
echo "🗄️  Migrating database schema..."
echo "Choose environment:"
echo "1) Local development"
echo "2) Production"
read -p "Enter choice (1 or 2): " env_choice

if [ "$env_choice" = "1" ]; then
    echo "Migrating to local database..."
    wrangler d1 execute iburuh-db --file=schema.sql --local
elif [ "$env_choice" = "2" ]; then
    echo "Migrating to production database..."
    wrangler d1 execute iburuh-db --file=schema.sql --remote
else
    echo "❌ Invalid choice"
    exit 1
fi

echo "✅ Database migration complete"
echo ""

# Build project
echo "🔨 Building project..."
npm run build
echo "✅ Build complete"
echo ""

# Deploy to Cloudflare Pages
echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=iburuh-app
echo ""

echo "========================================"
echo "✅ Deployment complete!"
echo "========================================"
echo ""
echo "📝 Next steps:"
echo "1. Go to Cloudflare Dashboard > Pages > iburuh-app"
echo "2. Settings > Environment Variables"
echo "3. Add: DATABASE_ID = $DB_ID"
echo "4. Settings > Functions > D1 database bindings"
echo "5. Add binding: Variable name 'DB', D1 database 'iburuh-db'"
echo ""
echo "🎉 Your app should be live shortly!"
