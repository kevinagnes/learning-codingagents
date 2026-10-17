#!/usr/bin/env node
/**
 * Verifies every code excerpt in the "Anatomy of a Coding Agent" material against the
 * real source tree.
 *
 * A fence is checked when it names a source file and line, either as the first body line
 * (`// packages/core/src/session/runner/llm.ts:57`) or as a bare anchor line directly
 * above the fence. A body may re-anchor itself with further `// path:line` lines; each
 * run is validated against its own anchor.
 *
 * Each run is split on `…` (elision). Blank lines are ignored on both sides, so trimming
 * an excerpt never fabricates a mismatch. The non-empty lines of each segment must appear,
 * in order, as consecutive non-blank source lines at or after the cited line.
 *
 * Runs under Node and Bun. Run from the repository root:
 *   node docs/agent-architecture/scripts/check-anchors.ts
 */

import { readFile, readdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const DOCS = resolve(HERE, "..")
const ROOT = resolve(HERE, "../../..")

const ANCHOR = /(?:^|\s)((?:[\w./-]+\/)?[\w./-]+\.(?:ts|tsx|json|txt|md|py|sh)):(\d+)\b/
const BARE = /^\s*(?:\/\/\s*)?`?((?:[\w./-]+\/)?[\w./-]+\.(?:ts|tsx|json|txt|md|py|sh)):(\d+)`?\s*$/

async function markdown(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "scripts" || entry.name.startsWith(".")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await markdown(full)))
    else if (entry.name.endsWith(".md")) found.push(full)
  }
  return found
}

const files = await markdown(DOCS)
const cache = new Map()

async function source(path) {
  if (!cache.has(path)) {
    try {
      const lines = (await readFile(join(ROOT, path), "utf8")).split("\n")
      cache.set(
        path,
        lines.map((t, index) => ({ n: index + 1, t: t.trim() })).filter((line) => line.t !== ""),
      )
    } catch {
      cache.set(path, null)
    }
  }
  return cache.get(path)
}

let blocks = 0
let mismatches = 0
let elisions = 0

for (const path of files) {
  const label = path.slice(DOCS.length + 1)
  const lines = (await readFile(path, "utf8")).split("\n")

  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*```/.test(lines[i])) continue
    const above = lines[i - 1]?.match(BARE)
    const body = []
    let j = i + 1
    for (; j < lines.length; j++) {
      if (/^\s*```/.test(lines[j])) break
      body.push(lines[j])
    }
    i = j

    const runs = []
    for (const line of body) {
      const header = line.match(ANCHOR)
      if (header && /^\s*(?:\/\/|#|\/\*)/.test(line)) {
        runs.push({ path: header[1], line: Number(header[2]), lines: [] })
        continue
      }
      if (runs.length === 0) {
        if (above) runs.push({ path: above[1], line: Number(above[2]), lines: [] })
        else continue
      }
      runs.at(-1).lines.push(line)
    }

    for (const run of runs) {
      if (!run.path) continue
      const src = await source(run.path)
      if (!src) {
        console.log(`MISSING SOURCE  ${label}  ${run.path}`)
        mismatches++
        continue
      }
      blocks++

      const segments = run.lines.join("\n").split("…")
      if (segments.length > 1) elisions += segments.length - 1

      // A quoted line may be a trimmed or reflowed fragment of the source line (for
      // example a template-literal value, or a leading token elided on the previous
      // segment). Accept exact matches and prefix/suffix fragments. Backticks and
      // double quotes are unescaped because the material quotes the model-visible
      // string, while the source escapes them inside a template literal.
      const unescape = (s) => s.replace(/\\([`"])/g, "$1")
      const same = (a, b) => {
        const left = unescape(a)
        const right = unescape(b)
        return left === right || (right.length >= 6 && (left.endsWith(right) || left.startsWith(right)))
      }

      let fromLine = run.line
      let failed = false
      for (const segment of segments) {
        const wanted = segment
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "" && !ANCHOR.test(line))
        if (wanted.length === 0) continue

        const startIndex = src.findIndex((line) => line.n >= fromLine)
        let found = -1
        for (let k = Math.max(0, startIndex); k + wanted.length <= src.length; k++) {
          let ok = true
          for (let m = 0; m < wanted.length; m++) {
            if (!same(src[k + m].t, wanted[m])) {
              ok = false
              break
            }
          }
          if (ok) {
            found = k
            break
          }
        }
        if (found === -1) {
          failed = true
          let base = -1
          for (let k = Math.max(0, startIndex); k < src.length; k++) {
            if (same(src[k].t, wanted[0])) {
              base = k
              break
            }
          }
          let diverge = 0
          if (base >= 0) while (diverge < wanted.length && same(src[base + diverge]?.t ?? "", wanted[diverge])) diverge++
          console.log(
            `MISMATCH  ${label}  ${run.path}:${run.line}` +
              (base >= 0
                ? `  (diverges: wanted[${diverge}] vs src:${src[base + diverge]?.n ?? "EOF"})`
                : "  (segment start not found)") +
              `\n    wanted:\n${wanted
                .slice(Math.max(0, diverge - 1), diverge + 3)
                .map((line) => `      ?| ${line}`)
                .join("\n")}\n    source:\n${(base >= 0 ? src.slice(base + diverge - 1, base + diverge + 3) : [])
                .map((line) => `      ${line.n}| ${line.t}`)
                .join("\n")}`,
          )
          break
        }
        fromLine = src[found + wanted.length - 1].n + 1
      }
      if (failed) mismatches++
    }
  }
}

console.log(`\nchecked ${blocks} code runs, ${mismatches} mismatch(es), ${elisions} elision marker(s)`)
process.exit(mismatches === 0 ? 0 : 1)
