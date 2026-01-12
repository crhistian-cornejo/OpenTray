# OpenTray Apple Code Signing Guide

This guide explains how to build a signed macOS application for OpenTray distribution, following the same approach as [OpenCode](https://github.com/anomalyco/opencode).

## Configuration

### Files Created

- **`src-tauri/entitlements.plist`** - App capabilities and permissions for macOS
- **`src-tauri/tauri.prod.conf.json`** - Production build configuration with signing
- **`scripts/check-certs.ts`** - Verify installed code signing certificates
- **`scripts/export-cert.ts`** - Export certificates to `.keys/` directory
- **`scripts/verify-apple-dev.ts`** - Verify Apple Developer account status
- **`scripts/build-signed.ts`** - Build signed app automatically

### Configuration Files

#### Development (`src-tauri/tauri.conf.json`)
```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "entitlements": "./entitlements.plist",
      "infoPlist": "Info.plist"
    }
  }
}
```

#### Production (`src-tauri/tauri.prod.conf.json`)
```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "entitlements": "./entitlements.plist",
      "hardenedRuntime": true,
      "infoPlist": "Info.plist"
    },
    "createUpdaterArtifacts": true
  }
}
```

## Quick Start

### 1. Verify Your Apple Developer Setup
```bash
bun run verify-apple-dev
```

This will:
- Check for Developer ID Application certificate
- Check for Apple Development certificate
- Display your Team ID
- Show your Apple Developer status

### 2. Build Signed Development App
```bash
bun run build-signed
```

Builds with:
- `src-tauri/tauri.conf.json` configuration
- Automatic certificate detection from your Keychain
- Development entitlements

### 3. Build Signed Production App
```bash
bun run build-prod
```

Builds with:
- `src-tauri/tauri.prod.conf.json` configuration
- Hardened runtime enabled
- Production entitlements
- Updater artifacts

## How It Works

### Certificate Detection
The scripts automatically find your certificates in the macOS Keychain:
```bash
security find-identity -v -p codesigning
```

### Automatic Signing
When building:
1. Script detects your `Developer ID Application` certificate
2. Sets `APPLE_SIGNING_IDENTITY` environment variable
3. Tauri uses this identity to sign the app
4. App is signed with your certificate

### Entitlements
The `entitlements.plist` file defines what your app can do:
- `com.apple.security.cs.allow-jit` - JIT compilation
- `com.apple.security.cs.allow-unsigned-executable-memory` - Required for V8/JavaScript
- `com.apple.security.automation.apple-events` - AppleScript/Automator access
- Other security exceptions as needed

## Your Current Setup

You have verified Apple Developer certificates:
- **Developer ID Application**: Crhistian Cornejo Ruiz (663F68N7L3)
- **Apple Development**: 120082161@untumbes.edu.pe (MNF6M2AZ7F)
- **Team ID**: 663F68N7L3

You are ready to build and sign OpenTray!

## Building for Distribution

### Step 1: Build the App
```bash
bun run build-prod
```

### Step 2: Locate the Built App
After building, find the `.dmg` in:
```
src-tauri/target/release/bundle/dmg/
```

### Step 3: Notarize (Required for Distribution)
For distribution outside Mac App Store, you must notarize:

```bash
xcrun notarytool submit OpenTray_0.2.0_x64.dmg \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "663F68N7L3" \
  --wait
```

Create app-specific password at: https://appleid.apple.com/account/manage

### Step 4: Staple the Ticket
```bash
xcrun stapler staple OpenTray_0.2.0_x64.dmg
```

## Manual Signing (Advanced)

If you need manual control:

### Build with Custom Identity
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Crhistian Cornejo Ruiz (663F68N7L3)"
bun run tauri build --config ./src-tauri/tauri.prod.conf.json
```

### Verify Signature
```bash
codesign -dv --verbose=4 src-tauri/target/release/bundle/dmg/OpenTray_0.2.0_x64.dmg
```

## Troubleshooting

### Certificate Not Found
```
No Developer ID Application certificate found!
```

**Solution:**
1. Verify certificate is installed: `bun run check-certs`
2. Check certificate expiration in Keychain Access
3. Ensure certificate is in login keychain

### Build Fails
```
code object is not signed at all
```

**Solution:**
1. Check `APPLE_SIGNING_IDENTITY` environment variable is set
2. Run `bun run verify-apple-dev` to verify setup
3. Try building with verbose output

### Entitlements Error
```
entitlements not valid
```

**Solution:**
1. Review `src-tauri/entitlements.plist`
2. Ensure entitlements match your Apple Developer account
3. Verify bundle identifier in Apple Developer portal

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APPLE_SIGNING_IDENTITY` | Certificate identity string | Auto-detected |
| `NODE_ENV` | Build mode (development/production) | Optional |
| `TARGET` | Target platform (x86_64-apple-darwin, etc.) | Optional |

## Security Notes

### Protecting Certificates
- `.keys/` directory is in `.gitignore` (NEVER commit)
- Certificates are stored in your macOS Keychain
- Use strong passwords for exported certificates
- Backup certificates securely

### Code Signing Best Practices
- Always sign production builds
- Use hardened runtime for distribution
- Keep certificates up to date
- Monitor certificate expiration

## Scripts Reference

### `bun run check-certs`
Lists all installed code signing certificates.

### `bun run export-cert <identity>`
Exports a certificate to `.keys/` directory.

### `bun run verify-apple-dev`
Verifies Apple Developer account status and certificate setup.

### `bun run build-signed`
Builds development app with automatic signing.

### `bun run build-prod`
Builds production app with hardened runtime and signing.

## Comparison with OpenCode

This implementation follows the same pattern as OpenCode:

| Feature | OpenCode | OpenTray |
|---------|----------|----------|
| Development Config | `tauri.conf.json` | `tauri.conf.json` |
| Production Config | `tauri.prod.conf.json` | `tauri.prod.conf.json` |
| Entitlements | `entitlements.plist` | `entitlements.plist` |
| Build Scripts | `scripts/*.ts` | `scripts/*.ts` |
| Package Manager | Bun | Bun |
| Auto Certificate Detection | ✓ | ✓ |
| Hardened Runtime | ✓ | ✓ |
| Updater Support | ✓ | ✓ |

## Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Tauri Documentation](https://tauri.app/v2/guides/building/)
- [OpenCode GitHub Workflow](https://github.com/anomalyco/opencode/blob/main/.github/workflows/publish.yml)

## Questions?

- For OpenTray issues: [GitHub Issues](https://github.com/crhistian-cornejo/OpenTray/issues)
- For Apple Developer questions: [Apple Developer Forums](https://developer.apple.com/forums/)
