<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="OpenTray">
</p>

<h1 align="center">OpenTray</h1>

<p align="center">
  <strong>Menubar companion for <a href="https://opencode.ai">OpenCode</a></strong>
</p>

<p align="center">
  Monitor and control your AI coding sessions from the system tray.
</p>

<p align="center">
  <a href="https://github.com/crhistian-cornejo/OpenTray/releases/latest">
    <img src="https://img.shields.io/github/v/release/crhistian-cornejo/OpenTray?style=flat-square" alt="Latest Release">
  </a>
  <a href="https://github.com/crhistian-cornejo/OpenTray/releases">
    <img src="https://img.shields.io/github/downloads/crhistian-cornejo/OpenTray/total?style=flat-square" alt="Downloads">
  </a>
  <a href="https://github.com/crhistian-cornejo/OpenTray/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/crhistian-cornejo/OpenTray?style=flat-square" alt="License">
  </a>
</p>

---

## Download

Get the latest version from [Releases](https://github.com/crhistian-cornejo/OpenTray/releases/latest).

| Platform | Download |
|----------|----------|
| **macOS** (Apple Silicon) | [OpenTray_x.x.x_aarch64.dmg](https://github.com/crhistian-cornejo/OpenTray/releases/latest) |
| **macOS** (Intel) | [OpenTray_x.x.x_x64.dmg](https://github.com/crhistian-cornejo/OpenTray/releases/latest) |
| **Windows** | [OpenTray_x.x.x_x64-setup.exe](https://github.com/crhistian-cornejo/OpenTray/releases/latest) |

## Installation

### macOS

1. Download the `.dmg` file for your architecture
2. Open the DMG and drag **OpenTray** to your **Applications** folder
3. **Important:** Before first launch, run this command to remove quarantine:

```bash
xattr -cr /Applications/OpenTray.app
```

> **Why is this needed?** Apps downloaded from the internet are quarantined by macOS Gatekeeper. Since OpenTray is not notarized with an Apple Developer certificate, you need to manually remove the quarantine attribute to run it.

4. Launch OpenTray from Applications or Spotlight

### Windows

1. Download the `.exe` installer
2. Run the installer and follow the prompts
3. OpenTray will start automatically and appear in the system tray

## Features

- **System Tray App** - Lives in your menubar (macOS) or system tray (Windows)
- **Auto-Discovery** - Automatically finds OpenCode instances running on your machine
- **Real-Time Monitoring** - See session status with live updates
- **Chat Interface** - Interact with your AI coding sessions
- **Session Management** - Create, archive, and delete sessions
- **Diff Viewer** - Review code changes made by the AI
- **TODO Tracking** - Track tasks from your coding sessions
- **Native Notifications** - Get notified when the AI completes tasks
- **Auto-Updates** - Stay up to date with automatic updates

## How It Works

OpenTray connects to OpenCode instances running locally on your machine. It communicates via the OpenCode HTTP API to:

1. Discover running OpenCode instances
2. Subscribe to real-time session updates via SSE
3. Display session status and allow interaction

Make sure you have [OpenCode](https://opencode.ai) running before launching OpenTray.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Setup

```bash
# Clone the repository
git clone https://github.com/crhistian-cornejo/OpenTray.git
cd OpenTray

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `refactor:` Code refactoring

## License

[MIT](LICENSE)

---

<p align="center">
  Made with <a href="https://tauri.app">Tauri</a> + <a href="https://react.dev">React</a>
</p>
