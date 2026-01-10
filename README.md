# OpenTray

Menubar companion app for OpenCode - monitor and control your AI coding sessions from the system tray.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Release Setup

### 1. Generate Updater Keys

First, generate the keypair for signing updates:

```bash
npm run tauri signer generate -- -w ~/.tauri/opentray.key
```

This will output a **public key** - copy it and update `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      ...
    }
  }
}
```

### 2. Configure GitHub Secrets

Go to your repository Settings > Secrets and variables > Actions, and add:

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/opentray.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when generating the key |

#### For macOS Code Signing (Optional but Recommended)

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64 encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | e.g., "Developer ID Application: Your Name (XXXXXXXXXX)" |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Your Apple Team ID |

To encode your certificate:
```bash
base64 -i certificate.p12 | pbcopy
```

### 3. Create a Release

#### Option A: Using Git Tags
```bash
git tag v0.1.0
git push origin v0.1.0
```

#### Option B: Manual Trigger
1. Go to Actions tab in GitHub
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version (e.g., 0.1.0)

The workflow will:
1. Build for macOS (Intel + Apple Silicon), Windows, and Linux
2. Sign the binaries
3. Create a GitHub Release with all assets
4. Generate `latest.json` for auto-updates

## Auto-Update

The app automatically checks for updates on startup. Users will see a banner when a new version is available.

### Update Flow
1. App checks `https://github.com/crhistian-cornejo/OpenTray/releases/latest/download/latest.json`
2. If new version exists, shows update banner
3. User clicks "Update" to download and install
4. App restarts with new version

## Project Structure

```
OpenTray/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # React hooks (useOpenCode, useUpdater, etc.)
│   └── lib/                # API, types, utilities
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── command.rs      # Tauri commands
│   │   ├── tray.rs         # System tray logic
│   │   └── fns.rs          # NSPanel functions
│   └── tauri.conf.json     # Tauri configuration
└── .github/workflows/      # CI/CD
    ├── build.yml           # Build on PR/push
    └── release.yml         # Release workflow
```

## Supported Platforms

| Platform | Architecture | Format |
|----------|-------------|--------|
| macOS | Apple Silicon (aarch64) | .dmg, .app |
| macOS | Intel (x86_64) | .dmg, .app |
| Windows | x86_64 | .msi, .exe |
| Linux | x86_64 | .deb, .rpm, .AppImage |

## License

MIT
