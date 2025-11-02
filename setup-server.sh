#!/bin/bash

# CommHub Server Setup Script
# This script helps set up the CommHub server with Docker

set -e

echo "🚀 Setting up CommHub Server with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Navigate to server directory
cd packages/server

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing!"
    echo "   Especially change the JWT_SECRET to a secure random value."
    read -p "Press Enter when you've updated the .env file..."
fi

# Go back to project root
cd ../..

# Generate a secure JWT secret if not set
if grep -q "your-super-secret-jwt-key-change-this-in-production" packages/server/.env; then
    echo "🔐 Generating secure JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" packages/server/.env
    rm packages/server/.env.bak
    echo "✅ JWT secret updated"
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run migrations
echo "🗃️  Running database migrations..."
docker-compose exec -T server npm run prisma:migrate:deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
docker-compose exec -T server npm run prisma:generate

echo "✅ Setup complete!"
echo ""
echo "🌐 Server is running at: http://localhost:3000"
echo ""
echo "📊 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart"
echo ""
echo "📚 See packages/server/README.md for more details."
