import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const changelog = 'CHANGELOG.md'
const version = process.env.VERSION || '1.0.0'
const date = new Date().toISOString().split('T')[0]

const changes = execSync('git diff --name-only HEAD^ HEAD')
	.toString()
	.split('\n')
const modChanges = changes.filter(
	(file) => file.startsWith('mods/') && file.endsWith('.pw.toml')
)

const getModInfo = (filePath) => {
	const content = readFileSync(filePath, 'utf8')
	const nameMatch = content.match(/name\s*=\s*"(.+?)"/)
	const filenameMatch = content.match(/filename\s*=\s*"(.+?)"/)
	const authorMatch = content.match(/author\s*=\s*"(.+?)"/)
	const modPageMatch = content.match(/modPage\s*=\s*"(.+?)"/)
	const authorPageMatch = content.match(/authorPage\s*=\s*"(.+?)"/)
	if (!nameMatch || !filenameMatch || !authorMatch || !modPageMatch || !authorPageMatch) return null

	const modName = nameMatch[1]
	const version = filenameMatch[1]
	const author = authorMatch[1]
	const modPage = modPageMatch[1]
	const authorPage = authorPageMatch[1]

	return { modName, version, author, modPage, authorPage }
}

let changelogEntry = `## [${version}] - ${date}\n`

const added = []
const removed = []
const changed = []

modChanges.forEach((file) => {
	const modInfo = getModInfo(file)
	if (!modInfo) return
	const previousContent = execSync(`git show HEAD^:${file}`).toString('utf8')
	const prevVersionMatch = previousContent.match(/filename\s*=\s*"(.+?)"/)
	const prevVersion = prevVersionMatch ? prevVersionMatch[1] : null

	if (!prevVersion) {
		added.push(modInfo)
	} else if (prevVersion !== modInfo.version) {
		const changeType = prevVersion > modInfo.version ? 'Downgraded' : 'Updated'
		changed.push({ ...modInfo, changeType, prevVersion })
	}
})

const removedMods = execSync('git diff --name-status HEAD^ HEAD')
	.toString()
	.split('\n')
	.filter((line) => line.startsWith('D') && line.includes('mods/'))
	.map((line) => line.split('\t')[1])
	.map((file) => getModInfo(file))
	.filter(Boolean)

removed.push(...removedMods)

const generateTable = (mods) => {
	return mods.map(mod => `| [${mod.modName}](${mod.modPage}) | ${mod.version} | [${mod.author}](${mod.authorPage}) |`).join('\n')
}

if (added.length) {
	changelogEntry += '\n### Added\n'
	changelogEntry += '| Mod Name | Version | Author |\n'
	changelogEntry += '|----------|---------|--------|\n'
	changelogEntry += generateTable(added) + '\n'
}

if (changed.length) {
	changelogEntry += '\n### Changed\n'
	changelogEntry += '| Mod Name | Version | Author |\n'
	changelogEntry += '|----------|---------|--------|\n'
	changelogEntry += generateTable(changed.map(mod => ({ ...mod, version: `${mod.prevVersion} -> ${mod.version}` }))) + '\n'
}

if (removed.length) {
	changelogEntry += '\n### Removed\n'
	changelogEntry += '| Mod Name | Version | Author |\n'
	changelogEntry += '|----------|---------|--------|\n'
	changelogEntry += generateTable(removed) + '\n'
}

const currentChangelog = readFileSync(changelog, 'utf8')
const insertionPoint = currentChangelog.indexOf('## [')
const newChangelog =
	currentChangelog.slice(0, insertionPoint) +
	changelogEntry +
	'\n' +
	currentChangelog.slice(insertionPoint)

writeFileSync(changelog, newChangelog)

console.log('Updated CHANGELOG.md')
