#!/usr/bin/env bash

# ==============================================================================
# Print-On-Demand (POD) Store - Hostinger Ubuntu KVM VPS Launch Script
# Execute this script as root to orchestrate and start the production matrix.
# ==============================================================================

# Exit immediately if any command fails, or if a variable is unset
set -euo pipefail

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please execute this script as root (sudo ./deploy.sh)."
  exit 1
fi

echo "🚀 Starting host setup and application deployment..."

# 1. Update APT Packages
echo "🔄 Updating APT caches..."
apt-get update -y

# 2. Install Docker & Docker Compose V2 if missing
if ! command -v docker &> /dev/null; then
  echo "📦 Installing Docker Engine..."
  apt-get install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
fi

if ! docker compose version &> /dev/null; then
  echo "📦 Installing Docker Compose Plugin V2..."
  apt-get install -y docker-compose-plugin
fi

# 3. Setup Firewall Safety Ports (UFW)
echo "🔒 Configuring UFW Firewall..."
# Enable UFW but strictly allow SSH port first to avoid lockouts!
ufw allow 22/tcp comment 'Allow SSH connection'
ufw allow 80/tcp comment 'Allow HTTP client connections'
ufw allow 443/tcp comment 'Allow HTTPS secure connections'
echo "y" | ufw enable
ufw status verbose

# 4. Establish Mapped Physical Folders and Permissions
echo "📁 Setting up storage directories..."
mkdir -p ./data/uploads
mkdir -p ./data/postgres

# Set read/write permission mask so Next.js and Nginx Docker containers can share volume maps
chmod -R 777 ./data/uploads
chmod -R 700 ./data/postgres

echo "✅ Storage directories verified."

# 5. Check if .env configuration file exists
if [ ! -f .env ]; then
  echo "⚠️ Warning: .env file not found. Copying .env.production.example..."
  cp .env.production.example .env
  echo "📝 Please edit the .env file with your production secrets before starting."
fi

# 6. Lift-Off: Build and start the production container stack
echo "🏗️ Building and spinning up the Docker standalone production matrix..."
docker compose -f docker-compose.production.yml up --build -d

echo "✨ Deployment succeeded!"
echo "🌐 Your POD application is now serving traffic at http://localhost"
echo "📊 Run 'docker compose -f docker-compose.production.yml ps' to audit running services."
