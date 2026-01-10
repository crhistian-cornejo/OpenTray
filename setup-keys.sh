#!/bin/bash

# OpenTray - Tauri Signing Keys Setup Script
# This script generates new signing keys and configures GitHub secrets

set -e

KEYS_DIR=".keys"
KEY_NAME="opentray"

echo "==================================="
echo "OpenTray Signing Keys Setup"
echo "==================================="
echo ""

# Create keys directory if it doesn't exist
mkdir -p "$KEYS_DIR"

# Check if keys already exist
if [ -f "$KEYS_DIR/$KEY_NAME.key" ]; then
    echo "Warning: Existing keys found in $KEYS_DIR/"
    read -p "Do you want to generate NEW keys? This will overwrite existing ones. (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted. Using existing keys."
        exit 0
    fi
    # Backup old keys
    mv "$KEYS_DIR/$KEY_NAME.key" "$KEYS_DIR/$KEY_NAME.key.backup.$(date +%s)" 2>/dev/null || true
    mv "$KEYS_DIR/$KEY_NAME.key.pub" "$KEYS_DIR/$KEY_NAME.key.pub.backup.$(date +%s)" 2>/dev/null || true
fi

echo ""
echo "Step 1: Generate Tauri signing keys"
echo "------------------------------------"
echo "You will be prompted for a password."
echo "IMPORTANT: Remember this password! You'll need it for GitHub secrets."
echo "Tip: Press Enter for NO password (simpler but less secure)"
echo ""

# Generate keys
npx @tauri-apps/cli signer generate -w "$KEYS_DIR/$KEY_NAME.key"

echo ""
echo "Keys generated successfully!"
echo ""

# Read the generated keys
PRIVATE_KEY=$(cat "$KEYS_DIR/$KEY_NAME.key")
PUBLIC_KEY=$(cat "$KEYS_DIR/$KEY_NAME.key.pub")

echo "Step 2: Update tauri.prod.conf.json"
echo "------------------------------------"

# Update the public key in tauri.prod.conf.json
if [ -f "src-tauri/tauri.prod.conf.json" ]; then
    # Use node to update JSON properly
    node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('src-tauri/tauri.prod.conf.json', 'utf8'));
    config.plugins.updater.pubkey = '$PUBLIC_KEY';
    fs.writeFileSync('src-tauri/tauri.prod.conf.json', JSON.stringify(config, null, 2) + '\n');
    console.log('Updated tauri.prod.conf.json with new public key');
    "
else
    echo "Warning: src-tauri/tauri.prod.conf.json not found"
    echo "You'll need to manually add this public key to your config:"
    echo "$PUBLIC_KEY"
fi

echo ""
echo "Step 3: Configure GitHub secrets"
echo "---------------------------------"

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) not found. Please install it or set secrets manually."
    echo ""
    echo "Manual setup required:"
    echo "1. Go to your repo Settings > Secrets and variables > Actions"
    echo "2. Add these secrets:"
    echo ""
    echo "TAURI_SIGNING_PRIVATE_KEY:"
    echo "$PRIVATE_KEY"
    echo ""
    echo "TAURI_SIGNING_PRIVATE_KEY_PASSWORD:"
    echo "(the password you entered above, or empty if none)"
    exit 0
fi

# Check if logged in to gh
if ! gh auth status &> /dev/null; then
    echo "Please login to GitHub CLI first: gh auth login"
    exit 1
fi

echo ""
echo "Setting TAURI_SIGNING_PRIVATE_KEY secret..."
echo "$PRIVATE_KEY" | gh secret set TAURI_SIGNING_PRIVATE_KEY

echo ""
echo "Now enter the SAME password you used when generating the key."
echo "(Press Enter if you used no password)"
read -s -p "Password: " KEY_PASSWORD
echo ""

if [ -z "$KEY_PASSWORD" ]; then
    # Set empty password - gh secret set needs some input
    echo "" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    echo "Set empty password secret."
else
    echo "$KEY_PASSWORD" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    echo "Password secret set."
fi

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Keys saved to: $KEYS_DIR/"
echo "  - $KEY_NAME.key (private - KEEP SECRET)"
echo "  - $KEY_NAME.key.pub (public)"
echo ""
echo "GitHub secrets configured:"
echo "  - TAURI_SIGNING_PRIVATE_KEY"
echo "  - TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
echo ""
echo "Public key (for reference):"
echo "$PUBLIC_KEY"
echo ""
echo "Next steps:"
echo "1. Commit the updated tauri.prod.conf.json"
echo "2. Push a new tag to trigger a release: git tag v0.1.1 && git push origin v0.1.1"
echo ""
