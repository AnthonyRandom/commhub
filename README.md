# CommHub

A lightweight, privacy-focused communication platform for real-time text and voice chats among friends.

![Status](https://img.shields.io/badge/Status-In%20Development-orange)
![Version](https://img.shields.io/badge/Version-1.0%20MVP-blue)
![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20Linux-green)

## ✨ Key Features

- **Real-time Messaging**: Send and receive messages instantly with basic formatting support
- **Voice Communication**: Join voice channels for clear audio conversations
- **Server Management**: Create or join servers to organize your communities
- **Cross-Platform**: Works seamlessly on Windows and Linux
- **Privacy-First**: Designed with user privacy as a core principle
- **Open-Source Inspired**: Built using open-source technologies and best practices

## 🚀 Current Development

CommHub is currently in active development, focusing on delivering a solid MVP with core communication features. The project follows a structured approach with planned phases covering backend infrastructure, user interface, testing, and deployment.

## 🛠️ Technology Stack

- **Client**: Cross-platform desktop application
- **Backend**: Real-time server infrastructure
- **Communication**: WebRTC for voice, WebSockets for messaging
- **Database**: Lightweight data storage solutions

## 📋 Roadmap Highlights

- [x] User authentication and account management
- [x] Server creation and channel organization
- [x] Real-time text messaging with formatting
- [x] Voice channel implementation
- [x] Cross-platform installer packages
- [x] Self-hosting capabilities

## 🏠 Self-Hosting

CommHub supports self-hosting for users who prefer to run their own server. The server can be deployed using Docker for easy setup and management.

### Quick Setup (Windows/Linux)

1. **Prerequisites**: Install Docker and Docker Compose
2. **Run the setup script**:
   - **Windows**: Double-click `setup-server.bat` or run it from command prompt
   - **Linux/macOS**: Run `./setup-server.sh` from terminal
3. **Configure**: Edit `packages/server/.env` with your settings
4. **Access**: Server runs at `http://localhost:3000`

### Manual Setup

See `packages/server/README.md` for detailed deployment instructions, including production configuration, security setup, and troubleshooting.

### System Requirements

- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 5GB free space
- **Network**: Stable internet connection
- **OS**: Windows 10+, Ubuntu 18.04+, or any Docker-compatible system

---
