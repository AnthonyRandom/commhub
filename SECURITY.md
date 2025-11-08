# Security Policy

## Our Commitment

CommHub takes security seriously. This repository is source-available to allow security researchers and users to audit the code for potential vulnerabilities. We believe transparency builds trust.

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1.0 | :x:                |

**Current Stable Version:** 1.1.9

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** publicly disclose the vulnerability

- Do not open a public GitHub issue
- Do not post on social media or forums
- Do not share details with others before we've had time to address it

### 2. Report privately

Create a private security advisory on GitHub:

1. Go to the [Security tab](https://github.com/AnthonyRandom/commhub/security)
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability

**OR** contact the repository owner directly through GitHub.

### 3. Include in your report

- **Description:** Clear description of the vulnerability
- **Impact:** What could an attacker achieve?
- **Steps to reproduce:** Detailed steps to reproduce the issue
- **Affected versions:** Which version(s) are affected?
- **Proof of concept:** If applicable (no actual exploits, please)
- **Suggested fix:** If you have ideas (optional but appreciated)

## What to Expect

- **Acknowledgment:** We'll acknowledge your report within **48 hours**
- **Updates:** We'll keep you informed of our progress
- **Timeline:** We aim to patch critical vulnerabilities within **7 days**
- **Credit:** With your permission, we'll credit you in the security advisory and release notes

## Security Best Practices

### For Users

- ✅ Always download CommHub from official GitHub releases
- ✅ Keep your client updated to the latest version
- ✅ Use strong, unique passwords for your account
- ✅ Report suspicious behavior or messages

## Known Security Features

CommHub implements the following security measures:

### Server (NestJS/PostgreSQL)

- ✅ JWT-based authentication with secure token signing
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ Rate limiting on sensitive endpoints (ThrottlerModule)
- ✅ Environment variable validation at startup
- ✅ Helmet security headers
- ✅ CORS configuration for allowed origins
- ✅ Input validation with class-validator
- ✅ SQL injection protection via Prisma ORM

### Client (Tauri/React)

- ✅ Restricted filesystem access (scoped to app directories)
- ✅ Restricted HTTP scope (only approved domains)
- ✅ No shell access (disabled in allowlist)
- ✅ WebRTC encryption for voice/video calls
- ✅ Automatic update checks from official source

## Security Audit History

| Date       | Auditor         | Findings | Status   |
| ---------- | --------------- | -------- | -------- |
| 2025-11-08 | Internal Review | 10 items | Resolved |

Recent security improvements (November 2025):

- Fixed JWT secret default value vulnerability
- Implemented environment variable validation
- Restricted Tauri permissions to minimum required
- Removed circular dependencies that could cause issues
- Added health check endpoints for monitoring
- Implemented periodic cleanup for memory leak prevention

## Scope

### In Scope for Security Reports

- ✅ Authentication/authorization bypass
- ✅ SQL injection, XSS, CSRF
- ✅ Remote code execution
- ✅ Data leaks or exposure
- ✅ Denial of service vulnerabilities
- ✅ Cryptographic weaknesses
- ✅ Client-side security issues (Tauri/React)
- ✅ WebRTC/WebSocket security issues

### Out of Scope

- ❌ Social engineering attacks
- ❌ Physical access to servers
- ❌ DDoS attacks (infrastructure level)
- ❌ Issues in third-party dependencies (report to them directly)
- ❌ Issues requiring physical access to user devices
- ❌ Browser-specific bugs (report to browser vendors)

## Responsible Disclosure

We follow responsible disclosure practices:

1. **Private reporting** → You report privately
2. **Investigation** → We investigate and develop a fix
3. **Patch release** → We release a security patch
4. **Public disclosure** → We publish a security advisory (with your consent, crediting you)

We ask for **90 days** before public disclosure to give users time to update.

## Questions?

If you have questions about security that don't involve reporting a vulnerability, feel free to open a public GitHub discussion.
