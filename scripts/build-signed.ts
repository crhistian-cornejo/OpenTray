#!/usr/bin/env bun
/**
 * OpenTray Build Script
 * 
 * Builds, signs, and optionally notarizes the macOS app.
 * 
 * Environment variables (can be set in .env file):
 *   APPLE_SIGNING_IDENTITY - Override auto-detected signing identity
 *   APPLE_ID              - Apple ID for notarization
 *   APPLE_PASSWORD        - App-specific password for notarization
 *   APPLE_TEAM_ID         - Team ID for notarization
 *   NODE_ENV              - Set to "production" for prod config
 *   TARGET                - Build target (e.g., "aarch64-apple-darwin")
 *   SKIP_NOTARIZE         - Set to "1" to skip notarization
 */

import { $ } from "bun"
import { existsSync } from "fs"
import { join } from "path"

// Load .env file if it exists
const envPath = join(import.meta.dir, "..", ".env")
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text()
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=")
      const value = valueParts.join("=")
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

const script = async () => {
  console.log("🔨 Building signed macOS app for OpenTray...")
  console.log("")

  const isProd = process.env.NODE_ENV === "production"

  const configPath = isProd
    ? "./src-tauri/tauri.prod.conf.json"
    : "./src-tauri/tauri.conf.json"

  console.log(`📋 Config: ${configPath}`)
  console.log(`🏭 Mode: ${isProd ? "Production" : "Development"}`)

  try {
    // Get signing identity from env or auto-detect
    let identity = process.env.APPLE_SIGNING_IDENTITY
    
    if (!identity) {
      const result = await $`security find-identity -v -p codesigning | grep "Developer ID Application"`.text()
      const match = result.match(/"([^"]+)"/)

      if (!match) {
        console.error("❌ No Developer ID Application certificate found!")
        console.log('   Run "bun run check-certs" to verify your certificates')
        process.exit(1)
      }
      identity = match[1]
    }

    console.log(`🔐 Signing: ${identity}`)

    // Check for notarization credentials
    const hasDirectCreds = process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID
    const skipNotarize = process.env.SKIP_NOTARIZE === "1"
    const canNotarize = !skipNotarize && hasDirectCreds

    if (canNotarize) {
      console.log(`📝 Notarization: Enabled (Apple ID: ${process.env.APPLE_ID})`)
    } else if (skipNotarize) {
      console.log(`📝 Notarization: Skipped (SKIP_NOTARIZE=1)`)
    } else {
      console.log(`📝 Notarization: Disabled (no credentials in .env)`)
    }

    console.log("")
    console.log("=====================================")
    console.log("")

    const buildArgs = [
      "tauri",
      "build",
      "--config",
      configPath,
    ]

    if (process.env.TARGET) {
      buildArgs.push("--target", process.env.TARGET)
      console.log(`🎯 Target: ${process.env.TARGET}`)
    }

    console.log(`🚀 Running: npx ${buildArgs.join(" ")}`)
    console.log("")

    // Build environment
    const buildEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      APPLE_SIGNING_IDENTITY: identity,
    }

    await $`npx ${buildArgs}`.env(buildEnv)

    console.log("")
    console.log("✅ Build complete!")
    console.log("")

    // Verify signing
    const appName = isProd ? "OpenTray.app" : "OpenTray Dev.app"
    const appPath = `src-tauri/target/release/bundle/macos/${appName}`
    
    console.log("🔍 Verifying signature...")
    try {
      const signInfo = await $`codesign -dv "${appPath}" 2>&1 | head -5`.text()
      console.log(signInfo)
    } catch {
      console.log("   (Could not verify - app may not exist yet)")
    }

    console.log("")
    console.log("📦 Output locations:")
    console.log(`   App: ${appPath}`)
    console.log("   DMG: src-tauri/target/release/bundle/dmg/")

  } catch (error) {
    console.error("❌ Build failed:", error)
    process.exit(1)
  }
}

script()
