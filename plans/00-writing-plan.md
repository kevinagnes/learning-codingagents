# Writing plan — "Anatomy of a Coding Agent"

Record of the agreed plan. This document is the contract for the material under
`docs/agent-architecture/`. If a part disagrees with this file, this file wins and the
part is wrong.

## Goal

Teach a well-versed developer how the agentic core of a coding agent works, well enough
to **build a comparable one from scratch** and to **read opencode's implementation**.
Concepts first, stack-agnostic; then opencode as the case study, with real
`file:line` anchors and verbatim excerpts. The material is also the source text for a
podcast: every topic must be narratable.

## Lineage

Ground truth is the `opencode-dev` tree at version **2.0.31**. The checkout is not a git
repository, so anchors use `path:line` against the recorded file inventory, not a commit
SHA. Re-verify every anchor at write time and again before publishing.

## Scope

**In:** model boundary, durable session state, event sourcing, the stop/step loop,
context assembly, tools (registry, runtime, built-ins, CodeMode), permissions and
human-in-the-loop, compaction, reliability and recovery, concurrency, steering,
subagents, snapshots/diffs/revert, the bus→server→client event feed, skills, MCP,
plugins-as-tool-sources, and a build-it-yourself roadmap.

**Out:** provider/auth/model catalogs and OAuth, TUI/desktop/web/console UI,
LSP/formatters, install/update/packaging, pricing/console/stats services, worktrees, and
the HTTP API beyond what a client needs to drive and observe the agent.

MCP, skills, CodeMode, and snapshots are nominally "features" but are in scope because
they are agentic (dynamic instruction and tool sources, code-as-tool-call, change
tracking).

## Layout

```
docs/agent-architecture/
  README.md
  00-orientation.md
  01-model-boundary.md
  02-durable-state.md
  03-the-agent-loop.md
  04-context-assembly.md
  05-tools.md
  06-permissions-hitl.md
  07-compaction.md
  08-reliability.md
  09-concurrency-sessions.md
  10-snapshots-changes.md
  11-observability-api.md
  12-build-it-yourself.md
  appendices/
    A-prompt-atlas.md
    B-diagrams.md
    C-code-index.md
    D-glossary.md
    E-episode-map.md
  plans/
    00-writing-plan.md
    01-style-guide.md
```

## The spine

### Part 0 — Orientation (2)
- 0.1 What a coding agent actually is. Loop + tools + filesystem + persistence + permission. Why the rule is "one LLM call per step, no in-memory tool loop."
- 0.2 Architecture map: `schema → protocol/core → server`, `ai` beside them; Location-scoped vs global services; Effect as DI + structured concurrency; vocabulary.

### Part 1 — The model boundary (4)
- 1.1 Canonical request/response: `Message`, `SystemPart`, `LLMRequest`, tool definitions, generation options.
- 1.2 Streaming event union; partial tool input; finish reasons.
- 1.3 Output-token budgeting: `outputLimit`, measured vs estimated, reserve.
- 1.4 What leaks into agent correctness: provider metadata replay, reasoning, hosted tools.

### Part 2 — Durable state (5)
- 2.1 Sessions, ordered history, message types.
- 2.2 Bus → projector → SQLite; minimal durable events; `seq`; idempotency.
- 2.3 The inbox: admission vs execution; `steer`/`queue`; control items.
- 2.4 Write-ahead execution claim, terminals, restart recovery.
- 2.5 Replay and read models.

### Part 3 — The agent loop (5)
- 3.1 `drain → advanceToStep → runStep → attempt`.
- 3.2 One step = one LLM call; continuation from the durable record.
- 3.3 Parallel tool fibers; per-source ordering; uninterruptible settlement.
- 3.4 Step limits; terminal step (`toolChoice: none`).
- 3.5 The publisher and its concurrency invariants.

### Part 4 — Context assembly (8)
- 4.1 `select` vs `load`.
- 4.2 System-prompt assembly; conditional tool guidance; prompt-cache-stable ordering.
- 4.3 Instruction sources: content hashes, initial vs delta, blobs.
- 4.4 Discovery: AGENTS.md, config, instruction files, references.
- 4.5 Skills.
- 4.6 MCP.
- 4.7 Lowering: `toLLMMessages`.
- 4.8 Agents.

### Part 5 — Tools (8)
- 5.1 Contract and registration.
- 5.2 Snapshot: definitions + executor; namespaces.
- 5.3 Runtime validation and error formatting.
- 5.4 Output normalization, images, bounding to disk.
- 5.5 Built-in toolkit as prompt design.
- 5.6 Dangerous tools: patch, shell/pty, background shells.
- 5.7 CodeMode.
- 5.8 Plugins as tool sources.

### Part 6 — Permissions and HITL (4)
- 6.1 Rulesets, wildcard precedence, merge, saved rules.
- 6.2 ask/allow/deny, deferred replies, defect tunnel, `CorrectedError`.
- 6.3 Batch semantics.
- 6.4 Question tool and forms; interruption as control.

### Part 7 — Compaction (5)
- 7.1 Why and when: measured vs estimated, ceiling, reserve.
- 7.2 Triggers; shrink loop.
- 7.3 Summarization; template; keep-recent; checkpoint; update vs initial; nudge.
- 7.4 Native/provider compaction and provenance.
- 7.5 Output-limit fitting; effect on prompt caching.

### Part 8 — Reliability (4)
- 8.1 Retry policy.
- 8.2 retry vs continue vs recover-full.
- 8.3 Error taxonomy; content filter; unknown finish; incomplete stream.
- 8.4 Stale settlement after a crash.

### Part 9 — Concurrency and sessions (5)
- 9.1 Location scoping, instances, affinity.
- 9.2 Run coordinator.
- 9.3 Steering.
- 9.4 Subagents.
- 9.5 Multi-session concurrency and interruption.

### Part 10 — Snapshots and change tracking (3)
- 10.1 Snapshots.
- 10.2 Diffs and per-step files.
- 10.3 Revert.

### Part 11 — Observability and API (3)
- 11.1 Bus → server → live stream.
- 11.2 Driving the agent.
- 11.3 Persist vs stream.

### Part 12 — Build it yourself (2)
- 12.1 Milestone roadmap.
- 12.2 Pitfall catalog.

## Appendices

- **A — Prompt atlas.** Every prompt the agent sends or embeds, verbatim, with provenance and design commentary.
- **B — Diagram atlas.** All diagrams, source, ASCII fallback, and narration for audio.
- **C — Code index.** `file:line` anchors grouped by topic.
- **D — Glossary.** The vocabulary contract.
- **E — Episode map.** Topic ↔ episode, cold opens, hooks, takeaways, transitions.

## Episode arc (Appendix E)

One season, ~20 episodes: the loop is the product · talking to a model · everything is an
event · the inbox · the drain/step machine · tool contracts · output is a budget · code as
a tool call · the assembled prompt · instructions, skills, MCP · lowering to messages ·
agents and subagents · permissions · staying alive · context is finite · concurrency and
steering · snapshots · watching it work · crash and resume · build your own.

## Writing order

1. Foundations: style guide, glossary, plan.
2. Parts 00–12.
3. Appendices A–E (A and C after the parts so they can be cross-checked; B and E last).
4. README.

## Verification

- Every `file:line` re-checked against the tree at write time.
- A part is done when each topic has all eleven sections and every code excerpt exists at
  the cited path.
- `scripts/check-anchors.ts` re-verifies every code excerpt in every part against the
  source tree. Run from the repository root:
  `node docs/agent-architecture/scripts/check-anchors.ts`. It exits non-zero on any
  mismatch. Known allowances: elisions (`…`), blank lines, reflowed fragments (prefix or
  suffix matches), and backtick/quote escaping inside template literals.

## Non-goals

- No runnable reference implementation in this pass. If wanted, it is Phase 2 as a
  `reference/` folder.
- No provider, UI, or packaging coverage.
