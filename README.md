# Anatomy of a Coding Agent

How the agentic core of a coding agent works, taught from opencode's implementation.

This material has one goal: after reading it, you can build a comparable agent from
scratch, and you can read opencode's source and know where everything lives. It covers the
agentic machine only. Providers, model catalogs, user interfaces, packaging, and the
hosted services are out of scope.

Ground truth is the `opencode-dev` tree at version **2.0.31**. Every code anchor is a
`path:line` into that tree. See `plans/00-writing-plan.md` for the full contract and
`plans/01-style-guide.md` for how each topic is built.

## How to read this

Three paths, depending on what you want.

**The build path.** If you are implementing your own agent, read
[`12-build-it-yourself.md`](12-build-it-yourself.md) first for the roadmap, then walk the
parts in order, skipping nothing in Parts 2 and 3.

**The read-the-source path.** If you are working inside opencode, start with
[`00-orientation.md`](00-orientation.md) and [`03-the-agent-loop.md`](03-the-agent-loop.md),
then use [`appendices/C-code-index.md`](appendices/C-code-index.md) as your map and
[`appendices/D-glossary.md`](appendices/D-glossary.md) as your decoder.

**The listen path.** For podcast production, start with
[`appendices/E-episode-map.md`](appendices/E-episode-map.md). Every topic carries a
`Podcast notes` block with a hook, an analogy, talking points, and the question listeners
will ask.

## Contents

| Part | Subject | What it establishes |
|---|---|---|
| [0](00-orientation.md) | Orientation | What a coding agent is; the architecture map; the vocabulary |
| [1](01-model-boundary.md) | The model boundary | The request/response contract, streaming events, budgets, and the parts of the provider that leak into correctness |
| [2](02-durable-state.md) | Durable state | Sessions, the event bus and projectors, the inbox, the write-ahead claim, recovery |
| [3](03-the-agent-loop.md) | The agent loop | `drain → advanceToStep → runStep → attempt`, continuation, tool fibers, the publisher |
| [4](04-context-assembly.md) | Context assembly | `select`/`load`, the system prompt, instruction deltas, skills, MCP, lowering, agents |
| [5](05-tools.md) | Tools | The contract, the registry snapshot, validation, output bounding, the built-in toolkit, CodeMode, plugins |
| [6](06-permissions-hitl.md) | Permissions and HITL | Rulesets, ask/allow/deny, the defect tunnel, batching, questions |
| [7](07-compaction.md) | Compaction | Triggers, the shrink loop, summarisation, checkpoints, native compaction |
| [8](08-reliability.md) | Reliability | Retries, retry vs continue vs recover-full, the error taxonomy, stale settlement |
| [9](09-concurrency-sessions.md) | Concurrency and sessions | Location scoping, the run coordinator, steering, subagents, multi-session |
| [10](10-snapshots-changes.md) | Snapshots and change tracking | Snapshots, diffs, revert |
| [11](11-observability-api.md) | Observability and API | Bus → server → client, driving the agent, persist vs stream |
| [12](12-build-it-yourself.md) | Build it yourself | The milestone roadmap and the pitfall catalog |

## Appendices

- [A — Prompt atlas](appendices/A-prompt-atlas.md): every prompt, verbatim, with provenance and design commentary.
- [B — Diagram atlas](appendices/B-diagrams.md): all diagrams, with narration for audio.
- [C — Code index](appendices/C-code-index.md): `file:line` anchors grouped by topic.
- [D — Glossary](appendices/D-glossary.md): the vocabulary contract.
- [E — Episode map](appendices/E-episode-map.md): topic ↔ episode, hooks, takeaways.

## Conventions

- `packages/core/src/session/runner/llm.ts:57` style anchors are exact and verified at
  write time.
- Fenced code marked `// path:line` is **verbatim** from that location, trimmed only for
  length. Elisions are marked with `…`.
- `text` blocks are ASCII diagrams; `mermaid` blocks are their generated source.
- "Design note" marks commentary about what you should do, as opposed to what the code does.

## Keeping it honest

Every code excerpt is re-verified against the source tree:

```sh
node docs/agent-architecture/scripts/check-anchors.ts
```

It walks each part, finds every fence anchored with `// path:line` or a bare `path:line`
above it, and asserts the quoted lines still appear in that file at or after the cited
line. It exits non-zero on a mismatch, so run it after any refactor and before publishing.
