import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'

// Load environment variables from .env
dotenv.config()

// Get the CurseForge token from env variable
const CURSEFORGE_TOKEN = process.env.CURSEFORGE_TOKEN
if (!CURSEFORGE_TOKEN) {
  console.error('Error: CURSEFORGE_TOKEN environment variable is not set.')
  process.exit(1)
}

// Resolve current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Define the mods folder path
const modsFolder = join(__dirname, '..', 'mods')
const packFile = join(__dirname, '..', 'pack.toml')

// Fetch mods data from CurseForge API
async function fetchModsData(modIds) {
  const url = 'https://api.curseforge.com/v1/mods'
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': CURSEFORGE_TOKEN,
  }
  const body = JSON.stringify({ modIds, filterPcOnly: true })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch mods: ${response.statusText}`)
    }
    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching mod data:', error.message)
    return []
  }
}

// Main function to update MODLIST.md
async function main() {
  try {
    if (!existsSync(modsFolder)) {
      console.error("Error: 'mods' folder not found.")
      process.exit(1)
    }

    const modFiles = readdirSync(modsFolder).filter((file) => file.endsWith('.pw.toml'))

    if (modFiles.length === 0) {
      console.warn('Warning: No mod files found in the mods folder.')
      process.exit(0)
    }

    // Extract mod IDs and versions from mod files
    const modsInfo = modFiles
      .map((file) => {
        const content = readFileSync(join(modsFolder, file), 'utf8')
        const idMatch = content.match(/project-id\s*=\s*(\d+)/)
        const versionMatch = content.match(/filename\s*=\s*"(.*?)"/)
        return idMatch && versionMatch
          ? { id: parseInt(idMatch[1]), version: versionMatch[1].replace('.jar', '') }
          : null
      })
      .filter((info) => info !== null)

    if (modsInfo.length === 0) {
      console.warn('Warning: No valid project-ids found.')
      process.exit(0)
    }

    const modIds = modsInfo.map((info) => info.id)
    const modVersionsMap = new Map(modsInfo.map((info) => [info.id, info.version]))

    // Fetch mod data in one batch request
    const modsData = await fetchModsData(modIds)

    // Build mod list entries
    const modList = modsData.map((mod) => {
      const modName = mod.name.replace(/\|/g, '\\|')
      const modLink = mod.links?.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`
      const modOwner = mod.authors?.[0]?.name || 'unknown author'
      const modOwnerLink = mod.authors?.[0]?.url || `https://www.curseforge.com/members/${modOwner}`
      const modVersion = modVersionsMap.get(mod.id)
      return `| [${modName}](${modLink}) | ${modVersion} | [${modOwner}](${modOwnerLink}) |`
    })

    // Sort mod list entries by mod name
    modList.sort((a, b) => a.localeCompare(b))

    // Read the modpack version from pack.toml
    const packContent = readFileSync(packFile, 'utf8')
    const versionMatch = packContent.match(/version\s*=\s*"(.*?)"/)
    const modpackVersion = versionMatch ? versionMatch[1] : 'unknown'

    // Write to MODLIST.md
    const output = `# Modlist\n\nAll mods included in the current version of this modpack will be documented in this file.\n\n${modpackVersion} • ${
      modList.length
    } mods\n\n| Mod Name | Version | Author |\n| --- | --- | --- |\n${modList.join('\n')}\n`
    writeFileSync('MODLIST.md', output, 'utf8')

    console.log('✅ MODLIST.md updated successfully!')
  } catch (error) {
    console.error('❌ Error updating MODLIST.md:', error.message)
    process.exit(1)
  }
}

// Run the main function
main()
