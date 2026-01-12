#!/usr/bin/env bun
import { $ } from "bun"

const script = async () => {
  const args = process.argv.slice(2)
  const identity = args[0] || "Developer ID Application"

  console.log("Exporting certificate:", identity)

  try {
    const certs = await $`security find-certificate -c "${identity}" -a`.text()
    const certCount = (certs.match(/-----BEGIN CERTIFICATE-----/g) || []).length

    if (certCount === 0) {
      console.error("No certificate found with identity:", identity)
      process.exit(1)
    }

    console.log(`Found ${certCount} certificate(s)`)

    for (let i = 0; i < certCount; i++) {
      const outputFile = `.keys/${identity.replace(/[^a-zA-Z0-9]/g, "_")}_${i}.p12`

      console.log(`Exporting to ${outputFile}...`)

      try {
        await $`security export -t 0 -k ~/Library/Keychains/login.keychain-db -f pkcs12 -o ${outputFile} -P ""`
        console.log(`✓ Exported to ${outputFile}`)
      } catch (exportError) {
        console.error("Export failed. The certificate might be password-protected.")
        console.log("Please export manually from Keychain Access:")
        console.log("1. Open Keychain Access")
        console.log("2. Find your certificate")
        console.log("3. Right-click > Export...")
        console.log("4. Save as .p12 format")
        console.log("5. Store in .keys directory")
        process.exit(1)
      }
    }

    console.log("\n✓ Certificate export complete!")
    console.log("DO NOT commit .keys directory to version control!")

  } catch (error) {
    console.error("Error exporting certificate:", error)
    process.exit(1)
  }
}

script()
