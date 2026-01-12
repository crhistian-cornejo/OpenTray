#!/usr/bin/env bun
import { $ } from "bun"

const script = async () => {
  console.log("Verifying Apple Developer setup for OpenTray...\n")

  const checks = {
    hasDevId: false,
    hasAppleDev: false,
    devIdIdentity: null as string | null,
    appleDevIdentity: null as string | null,
  }

  try {
    const result = await $`security find-identity -v -p codesigning`.text()
    const lines = result.split("\n")

    for (const line of lines) {
      if (line.includes("Developer ID Application")) {
        const match = line.match(/"([^"]+)"/)
        if (match) {
          checks.hasDevId = true
          checks.devIdIdentity = match[1]
        }
      }
      if (line.includes("Apple Development")) {
        const match = line.match(/"([^"]+)"/)
        if (match) {
          checks.hasAppleDev = true
          checks.appleDevIdentity = match[1]
        }
      }
    }

    console.log("✓ Certificates:", checks.hasDevId && checks.hasAppleDev ? "FOUND" : "MISSING")

    if (checks.devIdIdentity) {
      console.log("\nDeveloper ID Application:")
      console.log("  Identity:", checks.devIdIdentity)
    }

    if (checks.appleDevIdentity) {
      console.log("\nApple Development:")
      console.log("  Identity:", checks.appleDevIdentity)
    }

    const teamIdMatch = checks.devIdIdentity?.match(/\(([^)]+)\)/)
    if (teamIdMatch) {
      console.log("\nTeam ID:", teamIdMatch[1])
    }

    console.log("\n" + "=".repeat(50))
    console.log("Apple Developer Status:", checks.hasDevId ? "✓ VERIFIED" : "✗ NOT FOUND")
    console.log("=".repeat(50))

    if (checks.hasDevId) {
      console.log("\n✓ You are ready to build and sign OpenTray!")
      console.log("\nNext steps:")
      console.log("  1. Run: bun run build-signed")
      console.log("  2. For production: bun run build-prod")
    } else {
      console.log("\n⚠️  Developer ID Application certificate not found!")
      console.log("\nTo get started:")
      console.log("  1. Join Apple Developer Program: https://developer.apple.com/programs/")
      console.log("  2. Create a certificate: https://developer.apple.com/account/resources/certificates/list")
      console.log("  3. Download and install in Keychain Access")
      console.log("  4. Run: bun run check-certs")
    }

  } catch (error) {
    console.error("Error checking certificates:", error)
    process.exit(1)
  }
}

script()
