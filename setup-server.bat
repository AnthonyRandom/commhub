@echo off
REM CommHub Server Setup Script for Windows
REM This script helps set up the CommHub server with Docker

echo 🚀 Setting up CommHub Server with Docker...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    echo    Visit: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    docker compose version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker Compose is not available. Please install Docker Compose.
        pause
        exit /b 1
    )
)

REM Navigate to server directory
cd packages\server

REM Check if .env exists
if not exist ".env" (
    echo 📋 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit .env file with your configuration before continuing!
    echo    Especially change the JWT_SECRET to a secure random value.
    pause
)

REM Go back to project root
cd ..\..

REM Generate a secure JWT secret if not set
findstr /C:"your-super-secret-jwt-key-change-this-in-production" packages\server\.env >nul
if %errorlevel% equ 0 (
    echo 🔐 Generating secure JWT secret...
    REM Generate random string for Windows
    powershell -command "$secret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString())); (Get-Content packages\server\.env) -replace 'your-super-secret-jwt-key-change-this-in-production', $secret | Set-Content packages\server\.env"
    echo ✅ JWT secret updated
)

REM Start services
echo 🐳 Starting Docker services...
docker-compose up -d

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Run migrations
echo 🗃️  Running database migrations...
docker-compose exec server npm run prisma:migrate:deploy

REM Generate Prisma client
echo 🔧 Generating Prisma client...
docker-compose exec server npm run prisma:generate

echo ✅ Setup complete!
echo.
echo 🌐 Server is running at: http://localhost:3000
echo.
echo 📊 To view logs: docker-compose logs -f
echo 🛑 To stop: docker-compose down
echo 🔄 To restart: docker-compose restart
echo.
echo 📚 See packages/server/README.md for more details.

pause
