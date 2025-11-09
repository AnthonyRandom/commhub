# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.2.x   | Yes       |
| 1.1.x   | Yes       |
| < 1.1.0 | No        |

Current stable version: 1.2.0

## Reporting a Vulnerability

**Do not publicly disclose security vulnerabilities.**

To report a vulnerability:

1. Go to the [Security tab](https://github.com/AnthonyRandom/commhub/security)
2. Click "Report a vulnerability"
3. Provide detailed information

Alternatively, contact the repository owner directly through GitHub.

### Required Information

- Description of the vulnerability
- Impact and potential exploit scenario
- Steps to reproduce
- Affected versions
- Proof of concept (if applicable)
- Suggested fix (optional)

### Response Timeline

- Acknowledgment within 48 hours
- Critical vulnerabilities patched within 7 days
- Regular updates throughout the investigation
- Public disclosure after 90 days (with your consent)

## Security Features

### Server

- JWT authentication with secure token signing
- Bcrypt password hashing (10 rounds)
- Rate limiting on sensitive endpoints
- Environment variable validation at startup
- Helmet security headers
- CORS configuration
- Input validation
- Prisma ORM (SQL injection protection)

### Client

- Restricted filesystem access
- Restricted HTTP scope
- Shell access disabled
- WebRTC encryption
- Automatic update checks from official source

## Recent Security Improvements (November 2025)

- Fixed JWT secret default value vulnerability
- Implemented environment variable validation
- Restricted Tauri permissions to minimum required
- Removed circular dependencies
- Added health check endpoints
- Implemented periodic cleanup for memory leak prevention

## Scope

### In Scope

- Authentication/authorization bypass
- SQL injection, XSS, CSRF
- Remote code execution
- Data leaks
- Denial of service
- Cryptographic weaknesses
- Client-side security issues
- WebRTC/WebSocket security issues

### Out of Scope

- Social engineering
- Physical access to servers
- DDoS attacks (infrastructure level)
- Third-party dependency issues
- Physical access to user devices
- Browser-specific bugs
