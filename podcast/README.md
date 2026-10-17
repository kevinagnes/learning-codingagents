# Podcast — Anatomy of a Coding Agent

The season plan and production home for the podcast built from the written material in
`docs/agent-architecture/`.

## Read this first

1. [`00-format.md`](00-format.md) — the show's contract: cast, the ten segments, the time
   budget, the serial structure, and the production conventions.
2. [`01-script-style.md`](01-script-style.md) — how the lines are written, for a
   text-to-speech engine.
3. [`assets/pronunciation.md`](assets/pronunciation.md) — how every term is spoken.

Then walk the episodes in order.

## Season 1

Twenty episodes, roughly twenty-five minutes each, serial. Episode sources are the parts of
the written material listed against each row.

| Ep | Title | Topics | Source part(s) |
|---|---|---|---|
| 1 | The loop is the product | 0.1–0.2 | Part 0 |
| 2 | Talking to a model | 1.1–1.2, 1.4 | Part 1 |
| 3 | Everything is an event | 2.1–2.2, 2.5 | Part 2 |
| 4 | The inbox | 2.3 | Part 2 |
| 5 | The drain and step machine | 3.1–3.5 | Part 3 |
| 6 | Tool contracts | 5.1–5.3 | Part 5 |
| 7 | Output is a budget | 1.3, 5.4, 7.5 | Parts 1, 5, 7 |
| 8 | Code as a tool call | 5.5–5.8 | Part 5 |
| 9 | The assembled prompt | 4.1–4.2 | Part 4 |
| 10 | Instructions, skills, MCP | 4.3–4.6 | Part 4 |
| 11 | Lowering to messages | 4.7 | Part 4 |
| 12 | Agents and subagents | 4.8, 9.4 | Parts 4, 9 |
| 13 | Permissions | 6.1–6.4 | Part 6 |
| 14 | Staying alive | 8.1–8.3 | Part 8 |
| 15 | Context is finite | 7.1–7.4 | Part 7 |
| 16 | Concurrency and steering | 9.1–9.3, 9.5 | Part 9 |
| 17 | Snapshots | 10.1–10.3 | Part 10 |
| 18 | Watching it work | 11.1–11.3 | Part 11 |
| 19 | Crash and resume | 2.4, 8.4 | Parts 2, 8 |
| 20 | Build your own | 12.1–12.2 | Part 12 |

Speaking cold opens, talking points, running bits, and the "do not say" list are already
drafted in [`../appendices/E-episode-map.md`](../appendices/E-episode-map.md).

## Layout

```
podcast/
  README.md                    this file
  00-format.md                 the show's contract
  01-script-style.md           the spoken-register rulebook
  02-writing-brief.md          the per-episode brief for the rest of the season
  assets/
    pronunciation.md           how every term is spoken
  scripts/
    ep01.md                    the read-aloud script, fed to the speech engine
    epNN.md                    ...
    check-episodes.ts          budget and style validator
  beats/
    epNN.md                    the beat sheet the script was written from
  companion/
    epNN.md                    show notes: code, paths, prompts, diagrams, sources
```

## Per-episode workflow

1. **Beat sheet** from the episode's topics, using the eleven-section structure in the parts
   and the notes in Appendix E. Four body beats, no more.
2. **Script** against `00-format.md`, in the voice of `01-script-style.md`.
3. **Gates.** Factual against the parts. Terminology against the "do not say" list. Read
   aloud once. Word count in range. No symbols, digits, or paths in spoken lines.
4. **Companion.** Collect the code excerpts, anchors, the full prompt text, and the
   diagrams. This is where the material the audio skips is allowed to live.
5. **Generate.** Feed the script to the speech engine. Stage directions in square brackets
   are stripped first; speaker labels map to the three voices.

## The `scripts/` file format

- A header block: episode number, title, topics, runtime target, cast, artifact, sources,
  companion link.
- Ten segments, each under a `##` heading. Headings are production scaffolding and are never
  spoken.
- A label line: `HOST:`, `CO-HOST:`, or `EXPERT:`, alone on its line.
- The spoken text on the lines that follow, until the next label line or stage direction.
- Stage directions in square brackets on their own line. Stripped before generation.
- Everything else is spoken text.

## Status

| Item | State |
|---|---|
| Format spec | Done |
| Script style guide | Done |
| Writing brief | Done |
| Pronunciation sheet | Starter; extend as new terms appear |
| Scripts | **Complete**, episodes 1 to 20 |
| Beat sheets | **Complete**, episodes 1 to 20 |
| Companion notes | **Complete**, episodes 1 to 20 |
| Episode validator | `scripts/check-episodes.ts`, run from this directory |
| Anchor checker | `../scripts/check-anchors.ts`, run from the repository root |

### Season totals

| | |
|---|---|
| Episodes | 20 |
| Spoken words | 67,734 |
| Estimated runtime | about 7 hours 30 minutes at 150 words per minute |
| Files | 60 (20 scripts, 20 beat sheets, 20 companions) |
| Verification | validator 0 failures 0 warnings; anchor checker 0 mismatches across 478 code runs |
