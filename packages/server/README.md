# CommHub Server Deployment Guide

This guide covers how to deploy the CommHub server using Docker for self-hosting.

## Prerequisites

- Docker and Docker Compose installed
- At least 2GB RAM available
- 5GB free disk space
- Internet connection for initial setup

## Quick Start

1. **Clone the repository** (if not already done):

   ```bash
   git clone <your-repo-url>
   cd commhub
   ```

2. **Navigate to the server directory**:

   ```bash
   cd packages/server
   ```

3. **Copy environment configuration**:

   ```bash
   cp env.example .env
   ```

4. **Edit the .env file** with your configuration:

   ```bash
   # Required: Change this to a secure random string
   JWT_SECRET="your-unique-secure-jwt-secret-here"

   # Optional: Update allowed origins for your client
   ALLOWED_ORIGINS="http://your-client-domain.com"
   ```

5. **Return to project root and start services**:

   ```bash
   cd ../..
   docker-compose up -d
   ```

6. **Run database migrations**:

   ```bash
   docker-compose exec server npm run prisma:migrate:deploy
   ```

   **Note**: If this is your first time running with PostgreSQL, you may need to reset the migration history. The Docker setup includes the necessary migration files.

The server will be available at `http://localhost:3000`.

## Detailed Setup

### Environment Variables

| Variable          | Description                            | Default                                                            | Required              |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| `DATABASE_URL`    | PostgreSQL connection string           | `postgresql://commhub_user:commhub_password@postgres:5432/commhub` | Yes                   |
| `JWT_SECRET`      | Secret key for JWT tokens              | -                                                                  | Yes                   |
| `PORT`            | Server port                            | `3000`                                                             | No                    |
| `NODE_ENV`        | Environment mode                       | `development`                                                      | No                    |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000,http://localhost:5173`                      | No                    |
| `HTTPS_ENABLED`   | Enable HTTPS                           | `false`                                                            | No                    |
| `SSL_KEY_PATH`    | Path to SSL private key                | -                                                                  | Only if HTTPS enabled |
| `SSL_CERT_PATH`   | Path to SSL certificate                | -                                                                  | Only if HTTPS enabled |
| `REDIS_URL`       | Redis connection URL                   | `redis://redis:6379`                                               | No                    |
| `THROTTLE_TTL`    | Rate limiting time window (seconds)    | `60`                                                               | No                    |
| `THROTTLE_LIMIT`  | Rate limiting request limit            | `100`                                                              | No                    |

### Production Deployment

#### 1. Security Setup

**Generate a secure JWT secret**:

```bash
openssl rand -base64 32
```

**Enable HTTPS** (recommended):

- Obtain SSL certificates (Let's Encrypt recommended)
- Set `HTTPS_ENABLED=true`
- Set `SSL_KEY_PATH` and `SSL_CERT_PATH`
- Update `ALLOWED_ORIGINS` to use `https://`

#### 2. Database Configuration

**Use external PostgreSQL** (recommended for production):

- Update `DATABASE_URL` to point to your PostgreSQL instance
- Remove the `postgres` service from `docker-compose.yml`
- Ensure the database exists and user has proper permissions

#### 3. Scaling

**Add Redis for session management**:

- Redis is included in the compose file
- Configure your application to use Redis for sessions if needed

**Load balancing**:

- Deploy multiple server instances
- Use a reverse proxy (nginx, traefik) for load balancing
- Ensure sticky sessions for WebSocket connections

#### 4. Monitoring

**Health checks**:

- The containers include health checks
- Monitor `/health` endpoint for server status

**Logs**:

```bash
# View server logs
docker-compose logs -f server

# View database logs
docker-compose logs -f postgres
```

### Troubleshooting

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U commhub_user -d commhub
```

#### Server Won't Start

```bash
# Check server logs
docker-compose logs server

# Verify environment variables
docker-compose exec server env

# Test server health
curl http://localhost:3000/health
```

#### Migration Issues

```bash
# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec server npm run prisma:migrate:reset
```

### Backup and Recovery

**Database backup**:

```bash
# Create backup
docker-compose exec postgres pg_dump -U commhub_user commhub > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U commhub_user -d commhub < backup.sql
```

### Updating

1. Pull latest changes
2. Rebuild containers: `docker-compose up --build -d`
3. Run migrations: `docker-compose exec server npm run prisma:migrate:deploy`

### Ports

| Service    | Internal Port | External Port | Protocol   |
| ---------- | ------------- | ------------- | ---------- |
| Server     | 3000          | 3000          | HTTP/HTTPS |
| PostgreSQL | 5432          | 5432          | PostgreSQL |
| Redis      | 6379          | 6379          | Redis      |

### Security Considerations

- Change default database credentials in production
- Use strong JWT secrets
- Enable HTTPS in production
- Regularly update Docker images
- Monitor for security vulnerabilities
- Use firewall rules to restrict access to database port
- Implement proper logging and monitoring

## Support

For issues with this deployment:

1. Check the troubleshooting section above
2. Review Docker and application logs
3. Ensure all prerequisites are met
4. Verify environment configuration
