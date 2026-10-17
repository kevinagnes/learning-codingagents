#!/usr/bin/env node
/**
 * Validates podcast scripts against the season's budgets and spoken-style rules.
 *
 *   node scripts/check-episodes.ts          # all episodes
 *   node scripts/check-episodes.ts 7 8      # selected episodes
 *
 * Hard failures exit non-zero: digits, code, paths, camelCase, banned words,
 * cross-references, bad speaker labels, or a total outside 3,000–3,800 spoken words.
 * Warnings do not fail: segment budget drift, host share, long artifact reads.
 */

import { readFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const PODCAST = join(HERE, "..")
const SCRIPTS = join(PODCAST, "scripts")

const LABELS = new Set(["HOST", "CO-HOST", "EXPERT"])
const LABEL = /^([A-Z][A-Z -]{0,24}):\s*$/
const BANNED = ["just", "simply", "obviously", "basically", "leverage", "utilize", "at the end of the day"]
const BUDGET = [
  ["Cold open", 110, 140],
  ["Titles", 85, 110],
  ["Bridge", 50, 75],
  ["Body beat 1", 560, 640],
  ["Body beat 2", 560, 640],
  ["Body beat 3", 560, 640],
  ["Body beat 4", 560, 640],
  ["Artifact", 250, 320],
  ["Recap", 100, 120],
  ["Teaser", 100, 120],
]

const wanted = process.argv.slice(2).map((value) => Number(value)).filter((value) => Number.isFinite(value))
const all = (await readdir(SCRIPTS)).filter((name) => /^ep\d+\.md$/.test(name)).sort()

let failed = 0
let warned = 0

for (const name of all) {
  const number = Number(name.match(/^ep(\d+)/)[1])
  if (wanted.length > 0 && !wanted.includes(number)) continue

  const lines = (await readFile(join(SCRIPTS, name), "utf8")).split("\n")
  const segments = []
  let current = { name: "(front matter)", words: 0 }
  let who = null
  let artifactRead = 0
  const perSpeaker = { HOST: 0, "CO-HOST": 0, EXPERT: 0 }

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      current = { name: heading[1], words: 0 }
      segments.push(current)
      who = null
      continue
    }
    if (/^\s*```/.test(line)) {
      who = null
      continue
    }
    const label = line.match(LABEL)
    if (label) {
      who = label[1]
      if (!LABELS.has(who)) {
        console.log(`FAIL ${name}: unknown speaker label "${who}"`)
        failed++
      }
      continue
    }
    if (!who) continue
    if (line.trim() === "" || line.startsWith("#") || line.startsWith("**") || line.startsWith("|")) continue
    if (line.trim().startsWith("[")) continue
    if (line.trim() === "---") continue

    const words = line.split(/\s+/).filter(Boolean).length
    current.words += words
    perSpeaker[who] += words
    if (current.name.startsWith("8.") && line.trim().startsWith('"')) artifactRead = words

    const problems = []
    if (/\d/.test(line)) problems.push("digit")
    if (line.includes("`")) problems.push("backtick")
    if (/[A-Za-z_]+\.(ts|tsx|js|json|md)\b/.test(line)) problems.push("file path")
    if (/\b\w+[a-z][A-Z]\w*\b/.test(line)) problems.push(`camelCase "${line.match(/\b\w+[a-z][A-Z]\w*\b/)[0]}"`)
    if (/\b(Part \d|Appendix|§|→|D\d+)\b/.test(line)) problems.push("cross-reference")
    for (const word of BANNED) {
      if (new RegExp(`\\b${word}\\b`, "i").test(line)) problems.push(`banned "${word}"`)
    }
    if (problems.length > 0) {
      console.log(`FAIL ${name} [${current.name}]: ${problems.join(", ")}\n      ${line.slice(0, 110)}`)
      failed++
    }
  }

  const spoken = segments.filter((segment) => !segment.name.startsWith("("))
  const total = spoken.reduce((sum, segment) => sum + segment.words, 0)
  const cohostShare = total === 0 ? 0 : Math.round((100 * perSpeaker["CO-HOST"]) / total)

  const drift = []
  for (const [index, segment] of spoken.entries()) {
    let [, low, high] = BUDGET[index] ?? [segment.name, 0, Infinity]
    // The finale's recap names all ten rules, so it is allowed to run longer.
    if (segment.name.startsWith("9.") && number === 20) high = 200
    if (segment.words < low * 0.85 || segment.words > high * 1.15) {
      drift.push(`${segment.name}: ${segment.words} (budget ${low}-${high})`)
    }
  }

  const runtime = (total / 150).toFixed(1)
  const status = total >= 3000 && total <= 3800 ? "ok  " : "FAIL"
  if (status === "FAIL") failed++
  console.log(
    `${status} ${name}: ${total} words, ~${runtime} min, ${cohostShare}% co-host` +
      (perSpeaker.EXPERT > 0 ? `, ${Math.round((100 * perSpeaker.EXPERT) / total)}% expert` : ""),
  )
  if (cohostShare < 22 || cohostShare > 32) {
    console.log(`WARN ${name}: co-host share is ${cohostShare}% (target 25-30%)`)
    warned++
  }
  if (artifactRead > 120) {
    console.log(`WARN ${name}: artifact read is ${artifactRead} words (limit 120)`)
    warned++
  }
  if (drift.length > 0) {
    console.log(`WARN ${name}: segment drift -> ${drift.join("; ")}`)
    warned++
  }
}

console.log(`\n${failed} failure(s), ${warned} warning(s)`)
process.exit(failed === 0 ? 0 : 1)
