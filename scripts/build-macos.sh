#!/bin/bash
# Build script for macOS with code signing and notarization
# 
# Required environment variables:
#   APPLE_SIGNING_IDENTITY - Your Developer ID Application certificate
#                            Find with: security find-identity -v -p codesigning
#                            Example: "Developer ID Application: Your Name (TEAM_ID)"
#
# For notarization (optional but recommended):
#   Option 1 - Keychain profile (recommended):
#     APPLE_KEYCHAIN_PROFILE - Profile name created with xcrun notarytool store-credentials
#
#   Option 2 - Direct credentials:
#     APPLE_ID       - Your Apple ID email
#     APPLE_PASSWORD - App-specific password (create at appleid.apple.com)
#     APPLE_TEAM_ID  - Your 10-character Team ID
#
# Setup keychain profile (one-time):
#   xcrun notarytool store-credentials "OpenTray" \
#     --apple-id "your-email@example.com" \
#     --team-id "YOUR_TEAM_ID" \
#     --password "app-specific-password"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== OpenTray macOS Build ===${NC}"
echo ""

# Check for signing identity
if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
    echo -e "${YELLOW}Warning: APPLE_SIGNING_IDENTITY not set${NC}"
    echo "The app will be built without proper code signing."
    echo ""
    echo "Available signing identities:"
    security find-identity -v -p codesigning | grep "Developer ID Application" || echo "  (none found)"
    echo ""
    read -p "Continue without signing? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "Signing identity: ${GREEN}$APPLE_SIGNING_IDENTITY${NC}"
fi

# Check for notarization credentials
NOTARIZE=false
if [ -n "$APPLE_KEYCHAIN_PROFILE" ]; then
    echo -e "Notarization: ${GREEN}Using keychain profile '$APPLE_KEYCHAIN_PROFILE'${NC}"
    NOTARIZE=true
elif [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
    echo -e "Notarization: ${GREEN}Using direct credentials${NC}"
    NOTARIZE=true
else
    echo -e "Notarization: ${YELLOW}Skipped (no credentials)${NC}"
fi

echo ""
echo "Building..."
echo ""

# Build the app
npm run tauri build

if [ "$NOTARIZE" = true ]; then
    echo ""
    echo -e "${GREEN}Build complete! App is signed and will be notarized.${NC}"
else
    echo ""
    echo -e "${YELLOW}Build complete! App may need manual signing for distribution.${NC}"
fi

# Show output location
APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/OpenTray.app"
DMG_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/dmg"

if [ -d "$APP_PATH" ]; then
    echo ""
    echo "Output:"
    echo "  App: $APP_PATH"
    if [ -d "$DMG_PATH" ]; then
        echo "  DMG: $DMG_PATH"
    fi
    
    echo ""
    echo "Verify signing with:"
    echo "  codesign -dv --verbose=4 \"$APP_PATH\""
fi
