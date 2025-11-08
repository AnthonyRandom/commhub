# CommHub

<div align="center">

**A lightweight, cross-platform communication application for real-time text and voice chats**

[![License](https://img.shields.io/badge/License-Source%20Available-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.9-green.svg)](https://github.com/AnthonyRandom/commhub/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/AnthonyRandom/commhub/releases)

</div>

---

## About CommHub

CommHub is a modern communication platform featuring:

- **Real-time messaging** - Instant text chat with channels and direct messages
- **Voice & video calls** - High-quality WebRTC-based communication
- **Server communities** - Create and join communities with multiple channels
- **Friend system** - Connect with friends across servers
- **Modern UI** - Clean, responsive interface built with React and Tailwind CSS
- **Cross-platform** - Native desktop app for Windows and Linux (built with Tauri)

## 🔒 Source-Available Philosophy

**CommHub is source-available.** Here's what that means:

### Why Source-Available?

- ✅ **Transparency:** You can audit the code to verify there's no tracking, data collection, or malicious behavior
- ✅ **Security:** Security researchers can review the code and report vulnerabilities responsibly
- ✅ **Learning:** Developers can study the implementation for educational purposes
- ✅ **Trust:** Build confidence by seeing exactly how your data is handled

See the [LICENSE](LICENSE) file for complete details.

## 📥 Download

**Official releases only:**

➡️ **[Download from GitHub Releases](https://github.com/AnthonyRandom/commhub/releases)**

- **Windows:** `.msi` or `.exe` installer

⚠️ **Do not download CommHub from unofficial sources.** The official release page is the only trusted source.

## 🏗️ Technology Stack

### Client (Desktop App)

- **Framework:** Tauri (Rust + Web)
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Real-time:** Socket.io Client
- **WebRTC:** Native browser APIs

### Server (Hosted on Railway)

- **Framework:** NestJS (Node.js + TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **Real-time:** WebSocket (Socket.io)
- **Security:** Helmet, rate limiting, bcrypt

## 🔐 Security

Security and privacy are top priorities:

- 🔒 **End-to-end encryption** for voice/video (WebRTC)
- 🔑 **Secure authentication** with JWT and bcrypt password hashing
- 🛡️ **Rate limiting** to prevent abuse
- 🚫 **Minimal permissions** - Desktop app has restricted file and network access
- ✅ **Regular security audits** - Latest audit: November 2025

**Found a security issue?** Please read our [Security Policy](SECURITY.md) and report it responsibly.

## 📜 License

CommHub is licensed under a **Source-Available License**.

- **You MAY:** View, audit, and learn from the code
- **You MAY NOT:** Use, modify, redistribute, or host this software

See [LICENSE](LICENSE) for full terms.

## 🔗 Links

- **Download:** [GitHub Releases](https://github.com/AnthonyRandom/commhub/releases)
- **Official Server:** [commhub-production.up.railway.app](https://commhub-production.up.railway.app)
- **Security Policy:** [SECURITY.md](SECURITY.md)
- **Report Issues:** [GitHub Issues](https://github.com/AnthonyRandom/commhub/issues)

## ⚖️ Legal

- **Copyright © 2025 AnthonyRandom. All rights reserved.**
- CommHub name and branding are proprietary
- Unauthorized hosting or distribution is prohibited
- Only download from official GitHub releases

## 💬 Contact

For licensing inquiries, security reports, or other questions, please use GitHub Issues or Discussions.
