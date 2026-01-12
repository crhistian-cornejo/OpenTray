#!/usr/bin/env bun
import { $ } from "bun"

const script = async () => {
  console.log("Checking Apple Developer status...")

  try {
    const result = await $`security find-identity -v -p codesigning`.text()
    const lines = result.split("\n")

    let devIdFound = false
    let appleDevFound = false

    console.log("\nInstalled Code Signing Certificates:")
    console.log("===================================\n")

    for (const line of lines) {
      if (line.includes("Developer ID Application")) {
        const match = line.match(/"([^"]+)"/)
        if (match) {
          const identity = match[1]
          const certId = line.match(/([A-F0-9]{40})/)?.[0]
          console.log("✓ Developer ID Application:", identity)
          if (certId) {
            console.log("  Certificate ID:", certId)
          }
          devIdFound = true
        }
      }
      if (line.includes("Apple Development")) {
        const match = line.match(/"([^"]+)"/)
        if (match) {
          const identity = match[1]
          const certId = line.match(/([A-F0-9]{40})/)?.[0]
          console.log("✓ Apple Development:", identity)
          if (certId) {
            console.log("  Certificate ID:", certId)
          }
          appleDevFound = true
        }
      }
    }

    console.log("\nStatus:")
    console.log("=======")
    console.log("✓ Apple Developer:", devIdFound ? "YES" : "NO")
    console.log("✓ Apple Development:", appleDevFound ? "YES" : "NO")

    if (!devIdFound && !appleDevFound) {
      console.log("\n⚠️  No Apple Developer certificates found!")
      console.log("To get certificates, visit: https://developer.apple.com")
      process.exit(1)
    }

    console.log("\n✓ Ready to build and sign apps!")

  } catch (error) {
    console.error("Error checking certificates:", error)
    process.exit(1)
  }
}

script()
