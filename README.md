<p align="center">
  <img src="src-tauri/icons/icon.png" alt="OpenTray logo" width="128" height="128">
</p>
<p align="center">Menubar companion for OpenCode.</p>
<p align="center">
  <a href="https://github.com/crhistian-cornejo/OpenTray/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/crhistian-cornejo/OpenTray?style=flat-square" /></a>
  <a href="https://github.com/crhistian-cornejo/OpenTray/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/crhistian-cornejo/OpenTray/release.yml?style=flat-square" /></a>
</p>

---

### Installation

Download directly from the [releases page](https://github.com/crhistian-cornejo/OpenTray/releases).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `OpenTray_x.x.x_aarch64.dmg`       |
| macOS (Intel)         | `OpenTray_x.x.x_x64.dmg`           |
| Windows               | `OpenTray_x.x.x_x64-setup.exe`     |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

### Features

- System tray application - runs in your menubar
- Auto-discovery of OpenCode instances
- Session management (create, archive, delete)
- Real-time chat view with streaming
- Diff viewer for file changes
- TODO list tracking
- Native notifications
- Auto-updates

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Release Setup

#### 1. Generate Updater Keys

```bash
npm run tauri signer generate -- -w .keys/opentray.key --ci
```

#### 2. Configure GitHub Secrets

Go to Settings > Secrets and variables > Actions:

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `.keys/opentray.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password (empty if none) |

**For macOS Code Signing (Optional):**

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64 encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | e.g., "Developer ID Application: Name (ID)" |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Your Apple Team ID |

#### 3. Create a Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

### Auto-Update

The app automatically checks for updates on startup. When a new version is available, users see a banner to download and install.

### Architecture

```
OpenTray/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # useOpenCode, useUpdater, useTheme
│   └── lib/                # API, types, utilities
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Entry point with conditional updater
│   │   ├── command.rs      # Tauri commands
│   │   ├── tray.rs         # System tray
│   │   └── fns.rs          # NSPanel functions
│   ├── tauri.conf.json     # Dev configuration
│   └── tauri.prod.conf.json # Production config with updater
└── .github/workflows/      # CI/CD
    ├── build.yml           # Build on PR/push
    └── release.yml         # Multi-platform release
```

### Supported Platforms

| Platform | Architecture | Format |
|----------|-------------|--------|
| macOS | Apple Silicon (aarch64) | .dmg, .app |
| macOS | Intel (x86_64) | .dmg, .app |
| Windows | x86_64 | .msi, .exe |
| Linux | x86_64 | .deb, .rpm, .AppImage |

---

**Built with** [Tauri](https://tauri.app) | [React](https://react.dev) | [OpenCode](https://opencode.ai)
