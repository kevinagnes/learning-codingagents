# Part 4 — Context assembly

Before a step calls a model, opencode has to answer three questions: *who is asking*
(which session, which agent, which instruction sources, which tools), *with which model and
history*, and *what exactly do those become on the wire*. Context assembly is the machinery
that answers all three, and it is deliberately split so that the stable, expensive half is
resolved once and reused while the volatile half is re-read each step. This part covers the
`select`/`load` split, system-prompt assembly and its cache-stable ordering, the
content-addressed instruction pipeline with initial and delta rendering, discovery of
instruction files, skills, MCP, lowering projected history into provider messages, and
agents. It assumes you have read Part 1 (the model boundary) and Part 2 (durable state); the
terms *Session*, *step*, *instruction source*, and *lowering* are defined in Appendix D.

Topics in this part:

- **4.1 select vs load** — two phases, two records, and why they are separate.
- **4.2 System-prompt assembly** — parts, conditional tool guidance, prompt-cache-stable ordering.
- **4.3 Instruction sources** — content hashes, initial vs delta rendering, blob storage.
- **4.4 Discovery** — AGENTS.md, config, instruction files, references.
- **4.5 Skills** — catalog instruction plus on-demand `<skill_content>`.
- **4.6 MCP** — dynamic instruction block and tool source.
- **4.7 Lowering** — `toLLMMessages`, attachments, bounding, reasoning, provider metadata, checkpoints.
- **4.8 Agents** — definition, modes, model/permissions/steps, selection and default resolution.

---

## 4.1 select vs load

### Thesis

Context assembly runs in two phases: `select` fixes everything that identifies the request
(session, agent, instruction sources, tool snapshot), and `load` adds the two things that
change per step (the resolved model and the active history), so identity is resolved once and
history is re-read as often as it moves.

### Cold open

You are about to send the next request. Two things are silently different from last step: an
instruction file changed on disk, and a compaction replaced the middle of the conversation.
If selection and loading were one function, every step would re-read and re-hash every
instruction file, and the tool snapshot could change halfway through one execution. Something
has to be pinned while the rest is allowed to move.

### The concept

There are two things that can change between steps, and they have different lifetimes:

- **Identity** — the session, the agent, the set of instruction sources, and the tool
  snapshot. Within one execution these are stable. Resolving them is expensive: it reads
  files, hashes values, asks each tool source for its definitions, and filters by permission.
  You want to do it once, and you want a value that cannot silently mutate underneath you.
- **State** — the resolved model and the active history. These move every step: history grows
  as messages settle, a compaction rewrites the prefix, and a model switch changes the route.

`select` returns a **Selection**: no model, no messages, but a fixed list of instruction
sources and a fixed tool snapshot. `load` takes a Selection and returns a **Loaded**: the same
session, agent, and tools, plus a resolved model, the frozen instruction baseline text, and
the active message list. The two phases have different error types, which matters downstream:
selection fails by *not finding an agent*, while loading fails on *model resolution*.

The split buys three things. First, cost: selection is the expensive half and it is not
repeated for each of the steps inside one execution. Second, stability: because the tool
snapshot and instruction sources are captured in the Selection, a registry change or a file
change cannot alter the tools the model was already advertised. Third, selective reuse:
auxiliary flows — generating a title, for example — need a model but not instruction or tool
preflight, so they resolve only the capabilities they need rather than running the full
selection.

The rejected alternative is one function that returns everything. It is simpler to call and
worse to operate: it couples tool resolution to model resolution, it defeats reuse inside an
execution, and it makes it impossible to ask "what would this selection look like with a
different model?" without re-reading the world.

### Diagram

**D8 — context assembly pipeline.** Selection feeds loading; loading feeds lowering; hooks
run last, right before the request is issued.

```mermaid
flowchart TD
  S[sessionID] --> SEL["select(sessionID)<br/>session · agent · instruction sources · tool snapshot"]
  SEL -->|Selection| L["load(selection)<br/>resolve model · read active history · render baseline"]
  L -->|Loaded| T["baseTranscript<br/>system parts + lowered messages"]
  T --> HK["plugin context hook<br/>(agent, tools, draft request)"]
  HK --> REQ["LLM.request<br/>boundImages(unsupportedParts(...))"]
  REQ -->|LLMRequest| SEND[provider]
```

```text
  sessionID
     |
     v
  +----------------------------------------------------------+
  | select(sessionID)                                        |
  |   session, agent, instruction sources, tool snapshot     |
  +----------------------------------------------------------+
     | Selection { session, agent, instructions, tools }
     v
  +----------------------------------------------------------+
  | load(selection)                                          |
  |   resolve model, read active history, render baseline    |
  +----------------------------------------------------------+
     | Loaded { session, agent, model, initial, messages,     |
     |          tools }                                        |
     v
  baseTranscript -> system parts + lowered messages
     |
     v
  plugin "context" hook
     |
     v
  LLM.request( boundImages( unsupportedParts( messages ) ) )
     |
     v
  provider
```

**Narration.** A session ID goes in. Selection resolves who is asking — the session, the
agent, the list of instruction sources, and a frozen snapshot of the tools — and hands that
forward. Loading then resolves the model and reads the active history, producing the frozen
instruction baseline plus the live messages. That loaded bundle is lowered into provider
messages by `baseTranscript`, passed through a plugin hook that may rewrite the draft, and
finally normalized for the specific model — unsupported parts replaced, oversized images
bounded — before the request goes to the provider.

### The real thing

```ts
// packages/core/src/session/context.ts:29
export interface Selection {
  readonly session: SessionSchema.Info
  readonly agent: Agent.Selection & { readonly info: Agent.Info }
  readonly instructions: Instructions.List
  readonly tools: Tool.Snapshot
}

export interface Loaded {
  readonly session: SessionSchema.Info
  readonly agent: Agent.Selection & { readonly info: Agent.Info }
  readonly model: SessionRunnerModel.Resolved
  readonly initial: string
  readonly messages: ReadonlyArray<SessionMessage.Info>
  readonly tools: Tool.Snapshot
}

/**
 * Resolves model-request state in two phases: `select` fixes the Session,
 * agent, instruction sources, and tool snapshot; `load` adds the model and
 * active history for that selection. Auxiliary operations resolve only the
 * capabilities they need; request preparation stays separate from selection.
 */
```

```ts
// packages/core/src/session/context.ts:121
const select = Effect.fn("SessionContext.select")(function* (sessionID: SessionSchema.ID) {
  const session = yield* store.get(sessionID)
  if (!session) return yield* Effect.die(new Error(`Session not found: ${sessionID}`))
  if (session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID)
    return yield* Effect.interrupt

  yield* mcpTools.flush
  const agent = yield* agents.select(session.agent)
  if (!agent.info) return yield* new AgentNotFoundError({ sessionID: session.id, agent: session.agent ?? agent.id })
  // Session permissions narrow discovery the same way they narrow the tool snapshot.
  const permissions = Permission.merge(agent.info.permissions, session.permissions ?? [])
  const loaded = yield* Effect.all(
    {
      tools: registry.snapshot(permissions),
      builtins: builtins.load(),
      discovery: discovery.load(),
      skills: skillInstructions.load(permissions),
      references: referenceInstructions.load(),
      mcp: mcpInstructions.load(permissions),
      entries: entries.load(sessionID),
    },
    { concurrency: "unbounded" },
  )
  return {
    session,
    agent: { ...agent, info: agent.info },
    // Ordered from most to least shared across sessions so the baseline stays a reusable
    // prompt-cache prefix: user-level catalog and guidance, then project instructions, then
    // the date and environment, which vary by day and directory.
    instructions: Instructions.combine([
      CodeModeInstructions.make(loaded.tools.codeModeCatalog),
      loaded.mcp,
      loaded.references,
      loaded.skills,
      loaded.discovery,
      loaded.builtins,
      loaded.entries,
    ]),
    tools: loaded.tools,
  }
})

const load = Effect.fn("SessionContext.load")(function* (selection: Selection) {
  const model = yield* resolveModel(selection.session)
  const history = yield* SessionHistory.entriesForRunner(
    db,
    selection.session.id,
    selection.instructions,
    SessionProviderContext.provenance(model) ?? "local",
  )
  return {
    session: selection.session,
    agent: selection.agent,
    model,
    initial: history.initial,
    messages: history.entries.map((entry) => entry.message),
    tools: selection.tools,
  }
})
```

What to notice:

- `select` loads every instruction source and the tool snapshot **in parallel** with unbounded
  concurrency; the order of results is fixed by the `combine` call, not by completion order.
- Both phases return the tool snapshot unchanged, so the definitions the model is advertised
  cannot shift between `select` and the request.
- `select` refuses to run for a session whose Location differs from the current one — it
  interrupts rather than assembling for the wrong directory.
- `load` passes a provenance boundary (`SessionProviderContext.provenance(model)`) into
  history, so only compaction windows the selected model can actually replay are included.
- The Selection carries no model or messages; the Loaded carries both plus the frozen baseline
  text in `initial`.

### The prompts

No prompts in this topic — the prompts live in Appendix A under **Harness**.

### Build it

```ts
type Selection = {
  session: Session
  agent: Agent
  instructions: InstructionSource[]
  tools: ToolSnapshot
}

type Loaded = Selection & {
  model: ResolvedModel
  baseline: string           // frozen instruction text
  messages: Message[]        // active history
}

function select(sessionID): Selection {
  const session = store.get(sessionID)
  const agent = agents.select(session.agent)          // throws if unknown
  const permissions = merge(agent.permissions, session.permissions)
  return {
    session,
    agent,
    instructions: combine([
      codemodeSource(tools.codeModeCatalog),
      mcpSource(permissions),
      referencesSource(),
      skillsSource(permissions),
      discoverySource(),
      builtinsSource(),
      sessionEntriesSource(),
    ]),
    tools: registry.snapshot(permissions),
  }
}

function load(selection): Loaded {
  const model = resolveModel(selection.session)
  const { baseline, entries } = historyForRunner(selection.session.id, selection.instructions, provenanceOf(model))
  return { ...selection, model, baseline, messages: entries.map(e => e.message) }
}
```

Design notes: keep the two return types distinct so a caller cannot accidentally read
`messages` off a Selection. Resolve instructions and tools concurrently but assemble their
order deterministically. Let `select` interrupt when the session belongs to another Location
rather than silently building a request for the wrong working directory.

### How it fails

- **Selection drift.** If selection were folded into loading, a tool registered between two
  steps would appear mid-execution and the model would see a different tool list than the one
  its earlier calls were validated against.
- **Re-read cost.** Re-hashing every instruction file on every step turns a cheap inspection
  into steady-state I/O, and gives the prompt cache a new reason to miss.
- **Wrong Location.** Without the equality check, a resumed session could be assembled against
  the process's current directory instead of its own.
- **Missing baseline.** `InstructionState.initial` dies with
  `Instruction state not found during assembly` if a session has history but no instruction
  state row — a recovery gap, not a normal path.

### How you'd test it

Assert the invariant that selection is stable and loading is not: call `select` twice for the
same session and assert the instruction keys and tool definitions are equal; then append a
message and call `load` again and assert the messages grew while the Selection value is
unchanged (same object identity, or deep-equal). For the Location guard, build a Selection for
a session recorded in a different directory and assert the effect interrupts rather than
returning.

### Recap

- `select` fixes identity — session, agent, instruction sources, tool snapshot — once per
  execution; `load` adds model and active history per step.
- The split buys reuse, a frozen tool snapshot, and auxiliary flows that resolve only what they
  need.
- Selection carries no model or messages; Loaded carries both plus the frozen instruction
  baseline.

Next: how the system prompt is assembled from that baseline and what keeps its prefix cacheable.

### Podcast notes

**Hook:** The prompt has a part that must never move and a part that changes every day — and if you get the order wrong, you pay for the whole thing again on every step.
**Analogy:** A restaurant printing menus: the house rules and dishes are the same for every table, and only the daily special changes at the bottom — so the kitchen prints the stable part once.
**Talking points:** Selection is the expensive half you solve once; loading is the cheap half you re-solve each step. Returning the tool snapshot unchanged is what makes an execution internally consistent. Auxiliary flows skip the pieces they do not need.
**Listeners will ask:** Why not just cache the whole assembled request instead of two records?

---

## 4.2 System-prompt assembly, conditional tool guidance, and prompt-cache-stable ordering

### Thesis

The system prompt is an ordered list of parts — the base prompt with guidance for the tools
actually present, then the frozen instruction baseline — and the ordering is chosen so the
longest-lived, most-shared prefix sits first and the request-specific tail sits last.

### Cold open

Two sessions in the same repository, one minute apart, share almost the whole system prompt.
The provider still charges both as full-price input because one line near the top changed:
the date. A prompt that reorders itself, or that inserts "Today's date" first, is a prompt
that throws away the cache on every step.

### The concept

The system prompt is not one string; it is a *list of parts*, and the model sees them
concatenated in order. Two kinds of content go in:

1. **The base prompt** — the harness framing plus **conditional tool guidance**: lines that
   explain how to use the write, edit, and shell tools, emitted only when those tools are
   actually in this request's advertised set. The guidance is a list assembled in a fixed
   order, so the same tool set always produces the same bytes.
2. **The instruction baseline** — the frozen text of every instruction source at the current
   epoch (Part 4.3). This is a single part appended after the base prompt.

The ordering rule is about **prompt caching**. Providers cache a prefix of the input: if two
requests share a byte-identical prefix, the second is billed and served as a cache hit up to
the first difference. To maximize hits, you order the parts from most-shared to least-shared
across requests. A user-level catalog and guidance are shared across every session by the same
user; project instructions are shared across sessions in a repository; the date and
environment are shared only by requests in the same directory on the same day, so they go
last. The ordering comment in `select` states exactly this.

An alternative is to rank by "importance" and put the most important instructions first. That
optimizes for how the model reads, not for how the cache works, and the two conflict: the
most-cache-stable content is usually the least session-specific. opencode chooses the cache
order, because a cache miss is paid on every step.

### Diagram

**D23 — system-prompt part assembly.** Tool definitions select which guidance lines are
emitted; the guidance and base prompt form the first part; the frozen baseline forms the
second; the two are concatenated with stable ordering.

```mermaid
flowchart TD
  A[agent.system?] -->|yes| P1[first SystemPart = agent.system]
  A -->|no| B[base prompt system.txt]
  B --> G["render(tools):<br/>shell lines if 'shell'<br/>write line if 'write'<br/>edit line if 'edit'"]
  G --> P1
  P1 --> SYS["system: SystemPart[]"]
  BASE[frozen instruction baseline 'initial'] --> SYS
  SYS --> REQ[request system parts]
```

```text
  tool definitions (names)
        |
        +--> includes "shell"? -> shell guidance lines
        +--> includes "write"? -> write guidance line
        +--> includes "edit"?  -> edit guidance line
                                 |
   base prompt (system.txt) <----+   (${OPENCODE_TOOL_GUIDANCE})
        |
        v
   SystemPart[0] = base prompt
   SystemPart[1] = frozen instruction baseline
        |
        v
   request.system
```

**Narration.** The tool definitions decide which guidance lines exist. Those lines are spliced
into the base prompt at a placeholder, producing the first system part; the frozen instruction
baseline becomes the second. The order of the parts, and the order of the guidance lines
inside the first, is fixed, so the same inputs yield byte-identical output and the provider's
prefix cache keeps hitting.

### The real thing

```ts
// packages/core/src/session/model-request.ts:100
export const baseTranscript = (input: {
  readonly agent: Agent.Info
  readonly model: SessionRunnerModel.Resolved
  readonly tools: Tool.Snapshot
  readonly initial: string
  readonly messages: ReadonlyArray<SessionMessage.Info>
}) => {
  const providerMetadataKey = input.model.model.route.providerMetadataKey ?? input.model.model.provider
  return {
    providerMetadataKey,
    system: [
      input.agent.system
        ? input.agent.system
        : SessionSystemPrompt.make(input.tools.definitions.map((tool) => tool.name)),
      input.initial,
    ]
      .filter((part) => part.length > 0)
      .map(SystemPart.make),
    messages: toLLMMessages(input.messages, input.model.ref, providerMetadataKey),
  }
}
```

```ts
// packages/core/src/session/system-prompt.ts:5
export function make(tools: string[]) {
  return render(PROMPT, tools)
}

export function render(prompt: string, tools: string[]) {
  const instructions: string[] = []
  if (tools.includes("shell")) {
    instructions.push(
      "- Prefer dedicated tools over shell commands; fall back to the shell when a tool cannot do what you need.",
      "- Do not chain shell commands with separators like `echo \"====\";` or `printf '---'`; the output becomes noisy in a way that makes the user's side of the conversation worse.",
    )
  }
  if (tools.includes("write")) {
    instructions.push(
      "- Use the write tool to create files or completely replace their content. Prefer using the edit tool for targeted changes.",
    )
  }
  if (tools.includes("edit")) {
    instructions.push(
      "- Use the edit tool for targeted changes to existing text files. It replaces the exact text in `oldString` with `newString`, and the values must differ. By default, `oldString` must occur exactly once. If it occurs multiple times, include more surrounding context to make it unique or set `replaceAll` to true to replace every occurrence.",
    )
  }
  return prompt.replace("${OPENCODE_TOOL_GUIDANCE}", instructions.join("\n"))
}
```

```ts
// packages/core/src/session/context.ts:147
// Ordered from most to least shared across sessions so the baseline stays a reusable
// prompt-cache prefix: user-level catalog and guidance, then project instructions, then
// the date and environment, which vary by day and directory.
instructions: Instructions.combine([
  CodeModeInstructions.make(loaded.tools.codeModeCatalog),
  loaded.mcp,
  loaded.references,
  loaded.skills,
  loaded.discovery,
  loaded.builtins,
  loaded.entries,
]),
```

What to notice:

- The first system part is the agent's own `system` override if it has one, otherwise the
  generated base prompt; the second part is always the instruction baseline. Empty parts are
  filtered out, so an agent with no system prompt and an empty baseline produces no system
  parts at all.
- Guidance is keyed off the *effective* tool names in this request's snapshot, so a tool the
  session cannot use contributes no guidance.
- The ordering comment is normative: user-level catalog and guidance first, project
  instructions next, and only then the day/directory-varying date and environment. `select`
  assembles `combine([...])` in that order, and `combine` preserves it.

### The prompts

The base prompt, `packages/core/src/session/runner/prompt/system.txt:1`, verbatim:

```text
You are an AI agent running in OpenCode, a coding agent harness. Help the user accomplish their goals using the tools you have available.

# Harness
- Responses are rendered as GitHub-flavored Markdown.
- `<system-reminder>` blocks are harness instructions, not user-authored content. Read and follow them.
- Prefer parallelizing independent tool calls.
${OPENCODE_TOOL_GUIDANCE}

# Communication
- Use clear file paths when referring to files.
- Keep responses clear and concise, and avoid unnecessary technical jargon.

# Working in codebases
- Keep changes consistent with the structure, naming, style, and patterns of the surrounding code.
- Treat unfamiliar files or changes as potential user work and investigate before deleting or overwriting them.
```

Provenance: loaded as `PROMPT` in `system-prompt.ts:3`. The `${OPENCODE_TOOL_GUIDANCE}`
placeholder is the only substitution; it is replaced with the joined guidance lines (or an
empty string). The `<system-reminder>` sentence is load-bearing: it tells the model to treat
harness-injected reminders as instructions rather than as user speech, which is what lets the
compaction and step-limit prompts (Parts 3 and 7) ride in the conversation without being
mistaken for the user's own words.

The conditional guidance lines, from `packages/core/src/session/system-prompt.ts:11`:

```text
- Prefer dedicated tools over shell commands; fall back to the shell when a tool cannot do what you need.
- Do not chain shell commands with separators like `echo "====";` or `printf '---'`; the output becomes noisy in a way that makes the user's side of the conversation worse.
```

```text
- Use the write tool to create files or completely replace their content. Prefer using the edit tool for targeted changes.
```

```text
- Use the edit tool for targeted changes to existing text files. It replaces the exact text in `oldString` with `newString`, and the values must differ. By default, `oldString` must occur exactly once. If it occurs multiple times, include more surrounding context to make it unique or set `replaceAll` to true to replace every occurrence.
```

The write and edit lines are the tool descriptions expressed as an operating rule ("prefer
write for whole files, edit for changes"); the shell line encodes the harness's own output
conventions so the model does not produce the noisy chained commands the transcript renderer
would display badly. The tool descriptions themselves live in Appendix A under **Tools**.

### Build it

```ts
function assembleSystem(agent, tools, baseline): SystemPart[] {
  const base = agent.system ?? basePrompt.replace("${OPENCODE_TOOL_GUIDANCE}", guidanceFor(tools))
  return [base, baseline].filter(part => part.length > 0).map(SystemPart.make)
}

function guidanceFor(tools: string[]): string {
  const lines: string[] = []
  if (tools.includes("shell")) lines.push(SHELL_PREFER, SHELL_NO_CHAIN)
  if (tools.includes("write")) lines.push(WRITE_PREFER)
  if (tools.includes("edit"))  lines.push(EDIT_RULES)
  return lines.join("\n")          // fixed order -> stable bytes
}
```

Design notes: put the *least* session-specific content first, because the cache rewards the
longest shared prefix. Keep the guidance order fixed (shell, write, edit) rather than deriving
it from tool registration order, which could vary. If an agent overrides the system prompt
entirely, do not silently re-append the harness baseline for that agent's own guidance — the
override is honored as written, and only the instruction baseline follows it.

### How it fails

- **Nondeterministic order.** Assembling guidance from a map or a registry that reorders
  produces different bytes for the same tool set and destroys the cache — the failure is not
  a wrong answer, it is every request billed at full price.
- **Date first.** Putting the day/environment part before the shared instruction catalog
  guarantees a cache miss across midnight and across directories.
- **Guidance for absent tools.** Telling the model to prefer the write tool when `write` was
  denied by permission invites a tool call that cannot succeed.
- **Empty-part leakage.** An empty system part can still occupy a slot in some providers; the
  `.filter((part) => part.length > 0)` guard avoids sending a zero-length part.

### How you'd test it

Assert byte stability: build the system parts twice with the same agent, tool set, and
baseline and assert the serialized parts are identical. Then change only the date source's
value and assert the *first* part is unchanged and only the appended baseline tail differs —
this is the cache invariant expressed as a test. Separately, assert that a tool set without
`edit` produces a prompt with no edit guidance line.

### Recap

- The system prompt is an ordered list: base prompt (with conditional tool guidance) then the
  frozen instruction baseline.
- Guidance is emitted per present tool and in a fixed order so identical inputs yield
  identical bytes.
- Ordering runs most-shared to least-shared so the provider's prefix cache stays useful.

Next: where that frozen baseline comes from, and how it updates by hash delta.

### Podcast notes

**Hook:** You can pay twice for the same prompt without changing a single instruction, just by changing where the date goes.
**Analogy:** A shared lunch menu with a daily special: staple it on top and everyone re-reads the whole page; print the special at the bottom and the top is already memorized.
**Talking points:** The prompt is parts, not a string; guidance depends on which tools are present but its order is fixed. Providers cache a prefix, so ordering is an economic decision, not an aesthetic one.
**Listeners will ask:** What happens to the cache when a plugin rewrites the prompt after assembly?

---

## 4.3 Instruction sources: content-addressed hashes, initial vs delta rendering, and blob storage

### Thesis

Every instruction source canonicalizes its value, hashes it, and stores the value once in a
content-addressed blob; the model sees the full render the first time and a small delta when
the value later changes, while durable events carry only hashes.

### Cold open

You edit twenty lines of `AGENTS.md`. On the next step the model does not receive the whole
file again — it receives a targeted diff or a short "changed" note. And yet the record of that
change on disk stores a hash, not the text. Where did the text go, and how can a resumed
session reconstruct what the model actually saw?

### The concept

An **instruction source** is one composable input to the system prompt. It has a stable `key`,
an effect that *reads* its current value, and three renderers: `initial` (never seen before),
`changed` (seen before, value differs), and `removed` (was present, now absent). Sources are
ordered, and identical values must render identical bytes.

The pipeline is content-addressed:

- **Canonicalize and hash.** The value is reduced to canonical JSON — object keys sorted,
  no whitespace ambiguity — and SHA-256 hashed. The hash is the identity of the value.
- **Diff against previous.** For each source, compare the observed hash to the hash stored for
  that key. Unchanged keys are skipped; changed keys produce a *delta* entry mapping key to the
  new hash (or a `removed` marker). The values themselves go into a *blobs* map keyed by hash.
- **Store once.** Blobs are written with insert-or-ignore, so the same value stored by many
  sessions occupies one row. Durable instruction **state** keeps two maps: `initial_values`
  (the baseline for the current epoch) and `current_values` (the latest seen).

Rendering happens at two moments. The **baseline** — `renderInitial` over the epoch's
`initial_values` — is shown at the start of *every* model request; it is the system prompt's
instruction part. **Updates** — `renderUpdate` over a delta — are frozen into a durable
`system` message at the moment they are observed and appended to history, so the model reads
"this changed" at chronological position without the baseline being restated.

Two distinctions matter. `unavailable` means the read failed *temporarily*; the stored value
stands and, if there is no previous state yet, initialization is **blocked** rather than
seeded with a hole. `removed` is an *observed absence*: the source exists but its value is
gone, so the delta carries a tombstone and the update text says the content no longer applies.

An **epoch** ties baselines to compactions. A checkpoint supersedes chronological updates that
predate it, so its completion advances the epoch: the stored `current_values` become the new
`initial_values`, and history selection drops the update messages that the baseline now covers.

The rejected alternative is to store the rendered text per session and re-render on read.
Re-rendering later would require the original Location-scoped sources, which may not exist in
a resumed process — so opencode freezes the rendered text into the event and stores the
value by hash for the baseline.

### Diagram

**D14 — instruction hash/delta flow.** Observed values flow to hash, then to a diff against
stored state, then into blobs and a delta event; rendering splits into a baseline at request
time and frozen update text at commit time.

```mermaid
flowchart TD
  OBS[read sources] --> H["canonical(json) -> sha256"]
  H --> D["diff vs current_values"]
  D -->|unchanged| SKIP[skip]
  D -->|changed| DELTA["delta: key -> hash | removed"]
  D -->|changed| BLOB["blobs: hash -> value"]
  DELTA --> EV["publish InstructionsUpdated(delta, text)"]
  BLOB --> EV
  EV --> ST["project: state.through_seq, current_values<br/>insert blobs on conflict do nothing"]
  EV --> MSG["frozen update text -> system message in history"]
  ST --> BASE["renderInitial(initial_values) at each request"]
```

```text
  source.read(value)
      |
      v
  canonical(value) --sha256--> hash
      |
      +--> value -> blobs[hash] (insert-or-ignore)
      |
      v
  diff(observed, current_values)
      |unchanged        |changed
      v                 v
  (skip)           delta[key] = hash | "removed"
      |                 |
      |                 +--> frozen update text -> durable system message
      v
  renderInitial(epoch.initial_values) -> system part every request
```

**Narration.** Each source is read and its value hashed. The hash is compared to what was
stored: unchanged sources vanish, changed sources produce a delta entry and a blob. The blob
is written once; the delta and its frozen text are published together. At request time the
baseline is rendered from the epoch's initial values, and the update text already sits in
history.

### The real thing

```ts
// packages/core/src/instructions/index.ts:27
/**
 * One composable instruction source over canonical JSON — the same
 * representation that is hashed, stored, and replayed. `make` builds one from
 * a typed definition; renderers returning `undefined` skip (undecodable or
 * unrenderable historical values).
 */
export interface Source {
  readonly key: Key
  readonly read: Effect.Effect<Schema.Json | Unavailable | Removed>
  readonly initial: (value: Schema.Json) => string | undefined
  readonly changed: (previous: Schema.Json, current: Schema.Json) => string | undefined
  readonly removed: (previous: Schema.Json) => string | undefined
}
```

```ts
// packages/core/src/instructions/index.ts:142
export function diff(observed: ReadResult, previous?: Values): Effect.Effect<Admission, InitializationBlocked> {
  const blocked = previous ? [] : observed.flatMap((entry) => (isUnavailable(entry.value) ? [entry.key] : []))
  if (blocked.length > 0) return Effect.fail(new InitializationBlocked({ keys: blocked }))
  const delta: Record<string, Hash | Instruction.Removed> = {}
  const blobs: Record<string, Schema.Json> = {}
  for (const entry of observed) {
    if (isUnavailable(entry.value)) continue
    if (isRemoved(entry.value)) {
      if (previous && Object.hasOwn(previous, entry.key)) delta[entry.key] = Instruction.removed
      continue
    }
    const next = hash(entry.value)
    if (previous?.[entry.key] === next) continue
    delta[entry.key] = next
    blobs[next] = entry.value
  }
  return Effect.succeed({ delta, blobs })
}
```

```ts
// packages/core/src/instructions/index.ts:194
export function hash(value: Schema.Json) {
  return Hash.make(createHash("sha256").update(canonical(value)).digest("hex"))
}

export function applyHashDelta(values: Values, delta: Delta): Values {
  const result: Record<string, Hash> = { ...values }
  for (const [key, value] of Object.entries(delta)) {
    if (value === Instruction.removed) delete result[key]
    else result[key] = value
  }
  return result
}
```

```ts
// packages/core/src/instructions/index.ts:243
function canonical(value: Schema.Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`
  return JSON.stringify(value)
}
```

```ts
// packages/core/src/session/instruction-state.ts:38
export const commit = Effect.fn("InstructionState.commit")(function* (
  db: DatabaseService,
  bus: Bus.Interface,
  instructions: Instructions.List,
  observation: Observation,
) {
  if (!observation.initial && Object.keys(observation.delta).length === 0) return
  // The rendered text is frozen into the durable event because re-rendering it
  // later would require the original Location-scoped instruction sources.
  const text = observation.initial ? "" : yield* renderUpdateText(db, instructions, observation)
  yield* bus.publish(
    SessionEvent.InstructionsUpdated,
    {
      sessionID: observation.sessionID,
      delta: observation.delta,
      ...(text.length > 0 ? { text } : {}),
    },
    {
      // Initial sync establishes the baseline; unlike later deltas it is not chronological history.
      ...(observation.initial ? { metadata: { instructions: { initial: true } } } : {}),
      commit: () => insertBlobs(db, observation.blobs),
    },
  )
})
```

```ts
// packages/core/src/session/instruction-state.ts:164
/** Renders the epoch baseline shown at the start of every model request. */
export const initial = Effect.fn("InstructionState.initial")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  instructions: Instructions.List,
) {
  const state = yield* find(db, sessionID)
  if (!state) return yield* Effect.die(new Error(`Instruction state not found during assembly: ${sessionID}`))
  const blobs = yield* loadBlobs(db, Object.values(state.initial_values))
  return Instructions.renderInitial(instructions, dereference(state.initial_values, blobs))
})
```

What to notice:

- `canonical` sorts object keys, so two structurally equal values hash the same regardless of
  key order; `hash` is the only place identity is decided.
- `diff` returns both a `delta` (hashes) and `blobs` (payloads); the payload never travels in
  the durable event's hash field.
- `commit` freezes the *rendered text* into the event (`renderUpdateText`) because the update
  message must survive without the Location-scoped sources that produced it.
- `initial` renders the baseline from `initial_values` and dies loudly if the state row is
  missing — a baseline is mandatory for a session with history.

### The prompts

The generic update narration is owned by the source mechanism in
`packages/core/src/session/instruction-entry.ts:85`:

```ts
const renderBlock = (key: Key, value: Schema.Json) =>
  [`<context key="${key}">`, renderValue(value), "</context>"].join("\n")

// Rendering stays mechanism-neutral: the model sees session context, not how
// it was attached. Only chronological updates and removals carry narration.
const source = (entry: Info & { readonly removed: boolean }) =>
  Instructions.make<Schema.Json>({
    key: Instructions.Key.make(`api/${entry.key}`),
    codec: Schema.toCodecJson(Schema.Json),
    read: Effect.succeed(entry.removed ? Instructions.removed : entry.value),
    render: {
      initial: (value) => renderBlock(entry.key, value),
      changed: (_previous, value) =>
        [
          `The context under "${entry.key}" changed and supersedes the previous value:`,
          renderBlock(entry.key, value),
        ].join("\n"),
      removed: () => `The context under "${entry.key}" no longer applies. Disregard it.`,
    },
  })
```

The comment is the design statement: the *initial* render is plain content with no narration,
while *changed* and *removed* narrate, because a delta only makes sense next to the baseline it
amends. The `api/<key>` prefix keeps programmatically attached session context namespaced away
from built-in keys. The full catalog of renderers lives in Appendix A under **Instructions**.

### Build it

```ts
type Source<A> = {
  key: string
  read: Effect<A | Unavailable | Removed>
  render: {
    initial: (a: A) => string
    changed: (prev: A, next: A) => string
    removed?: (prev: A) => string
  }
}

function observe(sources, state): Admission {
  const blocked = state ? [] : sources.filter(unavailable).map(s => s.key)
  if (blocked.length) fail(new InitializationBlocked(blocked))
  const delta = {}, blobs = {}
  for (const s of sources) {
    const value = read(s)
    if (value === Unavailable) continue
    if (value === Removed) { if (state?.[s.key]) delta[s.key] = REMOVED; continue }
    const h = sha256(canonical(value))          // key-sorted JSON
    if (state?.[s.key] === h) continue
    delta[s.key] = h
    blobs[h] = value
  }
  return { delta, blobs }
}

function baseline(sources, values, blobStore): string {
  return sources
    .filter(s => values[s.key] !== undefined)
    .map(s => s.render.initial(blobStore[values[s.key]]))
    .join("\n\n")
}
```

Design notes: hash the canonical form, never the raw bytes, so key order does not create
spurious changes. Store blobs with insert-or-ignore so the same value deduplicates. Freeze the
rendered update text at commit time — do not plan to re-render it later, because the sources
that produced it may be gone after a restart. Treat "read failed" and "value removed"
differently: the first preserves the previous value, the second deletes it.

### How it fails

- **Unstable hashing.** Hashing raw JSON with unordered keys makes semantically identical
  values look changed, flooding history with deltas and defeating `diff`'s equality check.
- **Missing blob.** `loadBlobs` dies with `Instruction blob not found: <hash>` if a delta
  references a value that was never stored — a sign that the commit's blob insert and the
  event publish diverged.
- **Unavailable at initialization.** If the first observation hits an unavailable source,
  `diff` returns `InitializationBlocked` and the input stays pending; seeding an empty baseline
  instead would let the model work from an empty instruction set forever, because unchanged
  keys are skipped and the missing value never re-renders.
- **Re-rendering history.** If update text were re-rendered at replay time instead of frozen,
  a resumed session could show text the model never actually saw.

### How you'd test it

Assert the two invariants directly. First, idempotence: observe the same sources twice and
assert the second `delta` is empty. Second, delta correctness: change one source's value,
observe again, and assert the `delta` contains that key with a new hash, that `blobs` carries
the new value under that hash, and that the old blob is still resolvable. Then round-trip: feed
the `delta` through `applyHashDelta` and assert `current_values` matches a full re-read.

### Recap

- Instruction values are canonicalized, SHA-256 hashed, and stored once in content-addressed
  blobs; durable events carry hashes, not payloads.
- The baseline renders every request; changes freeze their rendered text into durable system
  messages at commit time.
- `unavailable` preserves the stored value and can block initialization; `removed` is an
  observed absence that tombstones the key.

Next: the sources that feed this pipeline — instruction files and references.

### Podcast notes

**Hook:** The prompt update you saw was a diff — but the record on disk is just a fingerprint, and the text lives somewhere else entirely.
**Analogy:** Version control: the commit is the hash, the file content is stored once in the object store, and you only get a diff when it changed.
**Talking points:** Content addressing gives every value a stable identity; a hash delta is cheap to store and replay. Freezing rendered text is what makes replay honest after a restart. Unavailable and removed are not the same thing.
**Listeners will ask:** Why store the value by hash instead of just rewriting the whole instruction block each time?

---

## 4.4 Discovery: AGENTS.md, config, instruction files, and references

### Thesis

Instruction files are discovered from a global config file, an ancestor walk for `AGENTS.md`,
configured globs/URLs, and read-triggered injection of nearby files, and are folded into one
ordered discovery source plus a separate references source.

### Cold open

You open a helper module three directories deep. A nearby `AGENTS.md` you never configured
suddenly becomes relevant. It should enter the conversation exactly once, survive compaction,
and not be re-injected every time you touch a file in that directory.

### The concept

There are four routes by which free-standing instruction text reaches the model:

1. **Global file** — `<global config dir>/AGENTS.md`, read once.
2. **Project walk** — from the current directory up to the project root (or the home
   directory), collecting each `AGENTS.md` on the way. Insertion order is global first, then
   project files nearest-to-farthest, and that order is render order.
3. **Configured entries** — the config's `instructions` list: globs, absolute paths, `~/`
   paths, and HTTP(S) URLs. Relative patterns search upward from the location to the project
   root; URLs are fetched once at config load and keep their last good copy if a fetch fails.
4. **Read-triggered injection** — after the read tool successfully reads a file or lists a
   directory, opencode walks upward from that path for `AGENTS.md` files below the Location
   root and injects them as durable synthetic messages.

The discovery component holds file *contents* in memory, keyed by path, and exposes them as a
single instruction source keyed `core/instructions`. It re-reads on watcher events, debounced
so an editor save burst produces one rescan, and it publishes an ephemeral event when the set
changes so dependents reload.

Read-triggered injection is deliberately *once per path per session*. A `Synthetic` message
carries an `instruction.paths` metadata ledger; before injecting, the loader decodes that
metadata from history and skips paths already present. An in-memory in-flight claim guards
against two same-step reads racing. Because the ledger is scanned from model-visible history,
a path whose synthetic message drops out (through compaction or revert) is re-discovered and
re-injected rather than staying silently lost.

**References** are a separate, smaller source: a list of external directories the model may
consult, each with a name and optional description. They are useful to the model only when a
description exists, so undiscribed references are filtered out, and the list is sorted by name.

The rejected alternative — one flat "instructions" blob — loses the per-file identity needed
for delta rendering and makes it impossible to attribute a change to a path.

### Diagram

**D24 — instruction discovery and injection.** Four discovery routes converge on one source;
the read tool adds a fifth, session-scoped route through a synthetic ledger.

```mermaid
flowchart TD
  G["global AGENTS.md"] --> D[InstructionDiscovery state files Map]
  W["project walk: cwd -> root AGENTS.md"] --> D
  C["configured: globs, abs paths, ~, URLs"] --> D
  D --> SRC["source key 'core/instructions'"]
  WATCH["watcher -> debounce 100ms -> reload"] --> D
  READ["read tool success"] --> UP["walk up from path for AGENTS.md"]
  UP --> LEDGER["previouslyInjected() from history metadata"]
  LEDGER --> SYN["publish Synthetic with instruction.paths"]
  SYN -.->|next read skips| LEDGER
  SRC --> SEL[select: instructions combine]
```

```text
  global AGENTS.md ─┐
  project walk ─────┤
  configured globs ─┼─► InstructionDiscovery (Map path->File)
  configured URLs ──┘         │
                              ▼
                     source "core/instructions"
                              │ (watch + debounce -> reload)
                              ▼
  read tool success ──► walk up for AGENTS.md ──► synthetic msg
                                                   + instruction.paths ledger
                                                   (re-inject if it leaves history)
```

**Narration.** Global, project, configured, and remote files all land in one in-memory map and
become a single instruction source that changes when files change. The read tool is a fifth
route: when it reads under the project it walks up for nearby `AGENTS.md` files and injects
any it has not injected in this session, recording the paths in message metadata so it does not
repeat them.

### The real thing

```ts
// packages/core/src/instruction-discovery.ts:104
        load: Effect.fn("InstructionDiscovery.load")(function* () {
          const files = yield* list()
          if (!Array.isArray(files)) return source(files)
          return source(files.length === 0 ? Instructions.removed : files)
        }),
```

```ts
// packages/core/src/instruction-discovery.ts:123
function render(files: ReadonlyArray<File>) {
  return files.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n")
}

function renderUpdate(previous: ReadonlyArray<File>, current: ReadonlyArray<File>) {
  const changes = Instructions.diffByKey(
    previous,
    current,
    (file) => file.path,
    (before, after) => before.content !== after.content,
  )
  return [
    ...changes.removed.map((file) => `The instructions from ${file.path} no longer apply.`),
    ...changes.added.map((file) => `New instructions apply from:\n${render([file])}`),
    ...changes.changed.map(({ previous: before, current: after }) => {
      const patch = createPatch(after.path, before.content, after.content, "", "", { context: 3 })
      const diff = [
        `The instructions from ${after.path} changed. Here's the diff:`,
        "```diff",
        patch.slice(patch.indexOf("@@")).trimEnd(),
        "```",
      ].join("\n")
      const replacement = `The instructions changed:\n${render([after])}`
      return diff.length < replacement.length ? diff : replacement
    }),
  ].join("\n\n")
}
```

```ts
// packages/core/src/config/plugin/instruction.ts:51
      const candidates = [
        ...(discovery.global ? [globalFile] : []),
        ...(project
          ? ancestorDirectories(start, stop)
              .map((directory) => join(directory, "AGENTS.md"))
              .filter((file) => discovery.global || file !== globalFile)
          : []),
      ]
```

```ts
// packages/core/src/session/instructions.ts:70
        // Publish directly rather than through Session.synthetic: a Location-scoped layer
        // cannot depend on Session (it routes through LocationServiceMap, forming a type
        // cycle with this node). The durable publish commits the synthetic and its metadata
        // ledger atomically, so releasing the claim afterwards cannot readmit the paths.
        yield* bus.publish(SessionEvent.Synthetic, {
          sessionID: input.sessionID,
          text: readable.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n"),
          description: `Loaded ${readable.map((file) => describePath(root, file.path)).join(", ")}`,
          metadata: { instruction: { paths: readable.map((file) => file.path) } },
        })
```

```ts
// packages/core/src/session/instructions.ts:99
function previouslyInjected(store: SessionStore.Interface, sessionID: SessionSchema.ID) {
  return Effect.gen(function* () {
    const history = yield* store.context(sessionID)
    return new Set(
      history
        .filter((message): message is SessionMessage.Synthetic => message.type === "synthetic")
        .flatMap(
          (message) =>
            Option.getOrUndefined(Schema.decodeUnknownOption(InjectedMetadata)(message.metadata))?.instruction.paths ??
            [],
        ),
    )
  })
}
```

What to notice:

- `load` maps an empty file set to `Instructions.removed`, so "no instruction files" is a
  tombstone rather than silence — a session that previously had files learns they are gone.
- `renderUpdate` prefers a unified diff over restating the file, but falls back to the full
  render when the diff would be *longer* (`diff.length < replacement.length`).
- The discovery map's insertion order *is* render order (documented on the `Editor` type at
  `instruction-discovery.ts:30`): config adds global then nearest-to-farthest project files.
- The injected synthetic's metadata is the only lasting ledger; the in-flight claim is released
  once the durable publish settles, so dropping the synthetic from history re-enables
  injection.

### The prompts

The discovery renderers above are the prompt text this topic owns. The read-injection text is
the same `Instructions from: <path>\n<content>` shape, wrapped in a synthetic message whose
human-facing description is `Loaded <relative paths>`.

The built-in date and environment sources, `packages/core/src/instructions/builtins.ts:24`,
produce:

```ts
Instructions.make({
  key: Instructions.Key.make("core/date"),
  codec: Schema.toCodecJson(Schema.String),
  read: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
  render: {
    initial: (date) => `Today's date: ${date}`,
    changed: (_previous, date) => `Today's date is now: ${date}`,
  },
}),
Instructions.make({
  key: Instructions.Key.make("core/environment"),
  codec: Schema.toCodecJson(Schema.String),
  read: Effect.sync(() =>
    [
      "<env>",
      `  Working directory: ${location.directory}`,
      `  Workspace root folder: ${location.project.directory}`,
      `  Is directory a git repo: ${location.vcs?.type === "git" ? "yes" : "no"}`,
      `  Platform: ${process.platform}`,
      `  Prefer ${global.tmp} over generic system temporary directories such as /tmp; it is pre-created and approved for external access.`,
      "</env>",
    ].join("\n"),
  ),
  render: {
    initial: (environment) =>
      ["Here is some useful information about the environment you are running in:", environment].join("\n"),
    changed: (_previous, environment) =>
      ["The environment you are running in is now:", environment].join("\n"),
  },
}),
```

These two are ordered *last* in the `combine` because they vary by day and directory, which is
the cache-ordering rule from 4.2. The references source renders as
`packages/core/src/reference/instructions.ts:23`:

```text
Project references provide additional directories that can be accessed when relevant.
<available_references>
  <reference>
    <name>...</name>
    <path>...</path>
    <description>...</description>
  </reference>
</available_references>
```

### Build it

```ts
function discoverFiles(): File[] {
  const files = []
  if (globalEnabled && isFile(globalFile)) files.push(read(globalFile))
  if (projectEnabled && contains(projectRoot, cwd))
    files.push(...walkUp(cwd, stop)          // nearest-to-farthest
      .map(dir => join(dir, "AGENTS.md"))
      .filter(isFile)
      .map(read))
  for (const source of configuredSources) files.push(...expand(source))  // glob / abs / ~ / url
  return files
}

// read-triggered
function onReadSuccess(target, sessionID) {
  const injected = ledgerFromHistory(sessionID)      // synthetic -> metadata.instruction.paths
  const candidates = walkUp(dirname(target), locationRoot)
    .filter(p => !injected.has(p))
  if (candidates.length) publishSynthetic(sessionID, readAll(candidates))
}
```

Design notes: keep the injected ledger in durable message metadata, not memory, so replay and
resume stay consistent; release any in-flight claim only after the durable write settles, or a
concurrent read could re-inject the same path. Deduplicate paths by resolved absolute path so
`./AGENTS.md` and the absolute form do not both appear.

### How it fails

- **Re-injection storms.** Without the history-backed ledger, every read under a directory
  re-injects its `AGENTS.md`, growing history and wasting context.
- **Orphaned ledger.** If the synthetic is dropped by compaction and the ledger is only in
  memory, the instructions disappear for the rest of the session with no way back; scanning
  history avoids that.
- **All-or-nothing unavailability.** A configured glob that fails should isolate to
  `unavailable`, not make the whole instruction set unavailable; the config plugin wraps each
  source with `isolate(...)` for exactly this reason.
- **Order drift.** Adding files in a different insertion order changes render order and
  therefore the baseline hash, forcing a spurious delta.

### How you'd test it

Drive a real discovery instance: add two files in the documented order and assert `list()`
returns them in that order and that a subsequent identical read yields no delta. Then remove
one file and assert the update text contains `no longer apply`. For injection, call the read
tool under a directory containing an unconfigured `AGENTS.md`, assert exactly one synthetic
message with the path in its metadata, call it again, and assert no second message.

### Recap

- Instruction files come from a global file, an ancestor walk, configured globs/URLs, and
  read-triggered injection of nearby `AGENTS.md`.
- The discovery map's insertion order is render order: global, then project nearest-to-farthest.
- Read-triggered injection is once per path per session, tracked by a durable metadata ledger so
  it re-injects after compaction drops the synthetic.

Next: skills, which are advertised as a catalog and fetched on demand.

### Podcast notes

**Hook:** You open one file and a piece of project documentation you never configured quietly joins the conversation — exactly once.
**Analogy:** Tabs you open in an editor: opening the folder brings its own README, but re-opening the same file does not bring a second copy.
**Talking points:** Four routes converge on one instruction source; the read tool adds a fifth. The ledger lives in message metadata so replay stays honest. Diffs beat restatement unless restatement is shorter.
**Listeners will ask:** What stops two files in the same step from injecting the same path twice?

---

## 4.5 Skills

### Thesis

Skills are advertised in the system prompt as a compact catalog of id, name, and description,
and their full instructions are fetched on demand as a `<skill_content>` block when the model
calls the skill tool.

### Cold open

You have a hundred skills, each several pages long. Pasting all of them into the prompt would
crowd out the conversation. The model only needs to know that they exist and how to fetch the
one it wants — everything else can wait for a tool call.

### The concept

Skills follow the *catalog-then-fetch* pattern. The system prompt contains only a **catalog**
instruction: for each available skill, its id, name, and one-sentence description. A skill is
advertised only if it has a description, is not opted out of auto-invocation
(`autoinvoke !== false`), and is not denied by permission for its id. The catalog is sorted by
id so its bytes are stable.

When the model decides a task matches a description, it calls the `skill` tool with the id.
The tool asserts a `skill` permission, then calls `Skill.prepare`, which reads the skill's
content and builds a `<skill_content>` block containing the skill body, the base directory
that relative paths resolve against, and a sampled list of the skill's files (up to ten,
excluding `SKILL.md`). The result is returned as a tool result and therefore entered the
conversation as ordinary tool output — the model asked for it, so it is present exactly when
needed.

Catalog deltas mirror the instruction-source rules. Adding or removing skills renders as a
small delta; changing a description (or any other change) restates the whole list, because a
partially changed catalog is not safely described by a delta. The catalog source's key is
`core/skill-guidance`, and an empty available set becomes `Instructions.removed`, which tells
the model to stop using previously listed skills.

The skill tool is marked `codemode: false`, so it stays on the provider's native tool list
rather than being wrapped in the `execute` tool — a skill load is a single, well-known call
that does not benefit from code-mode indirection (Part 5.7).

The rejected alternative is to inline every skill body in the prompt. It scales linearly in
context with the number of skills, most of which are irrelevant to any given task, and it
inflates the cache-stable prefix with content that differs per skill set.

### Diagram

**D25 — skill catalog and on-demand load.** The catalog is an instruction source; the skill
tool is the fetch; the fetched body becomes a tool result.

```mermaid
flowchart TD
  SK[Skill.Service.list] --> AVAIL["filter: not denied,<br/>has description, autoinvoke != false"]
  AVAIL --> SORT[sort by id]
  SORT --> CAT["catalog source 'core/skill-guidance'"]
  CAT --> PROMPT[system prompt: id / name / description only]
  PROMPT --> CALL["model calls skill tool (id)"]
  CALL --> PERM[permission.assert 'skill' id]
  PERM --> PREP["Skill.prepare: read body + base dir + file sample (<=10)"]
  PREP --> RES["<skill_content> tool result"]
  RES --> CONV[conversation]
```

```text
  Skill.list
     |  filter: not denied, described, autoinvoke
     v
  catalog instruction (id, name, description)  ---> system prompt
     |
     |  model decides a task matches -> calls skill tool(id)
     v
  permission.assert("skill", id)
     |
     v
  Skill.prepare -> <skill_content name=...> body + base dir + <skill_files> (<=10)
     |
     v
  tool result -> conversation
```

**Narration.** The skill service lists skills; the catalog keeps only the ones the model may
use and that are worth advertising, sorted by id. That catalog is the whole system-prompt
footprint. When the model calls the skill tool, a permission is checked and the full body is
read and wrapped, with its base directory and a small file listing, then returned as a tool
result so it enters the conversation only when needed.

### The real thing

```ts
// packages/core/src/skill/instructions.ts:16
const entries = (skills: ReadonlyArray<Summary>) =>
  skills.flatMap((skill) => [
    "  <skill>",
    `    <id>${skill.id}</id>`,
    `    <name>${skill.name}</name>`,
    `    <description>${skill.description}</description>`,
    "  </skill>",
  ])

const render = (skills: ReadonlyArray<Summary>) =>
  [
    "Skills provide specialized instructions and workflows for specific tasks.",
    "Use the skill tool to load a skill when a task matches its description.",
    "The user may also invoke a skill directly. When that happens, its instructions appear in the conversation as a <skill_content> block, the same shape the skill tool returns. A skill that is already present this way does not need to be invoked again.",
    ...(skills.length === 0
      ? ["No skills are currently available."]
      : ["<available_skills>", ...entries(skills), "</available_skills>"]),
  ].join("\n")
```

```ts
// packages/core/src/skill/instructions.ts:73
      load: Effect.fn("SkillInstructions.load")(function* (permissions) {
        const available = Skill.available(yield* skills.list(), permissions)
          .flatMap((skill) =>
            skill.description === undefined || skill.autoinvoke === false
              ? []
              : [{ id: skill.id, name: skill.name, description: skill.description }],
          )
          .toSorted((a, b) => a.id.localeCompare(b.id))
        return Instructions.make<ReadonlyArray<Summary>>({
          key: Instructions.Key.make("core/skill-guidance"),
          codec: Schema.toCodecJson(Schema.Array(Summary)),
          read: Effect.succeed(available.length === 0 ? Instructions.removed : available),
          render: {
            initial: render,
            changed: update,
            removed: () => "Skill guidance is no longer available. Do not use any previously listed skill.",
          },
        })
      }),
```

```ts
// packages/core/src/skill.ts:36
export const toModelOutput = (skill: Info, files: ReadonlyArray<string>) => {
  const directory = path.dirname(skill.path)
  return [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    "",
    skill.content.trim(),
    "",
    `Base directory for this skill: ${directory}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "Note: file list is sampled.",
    "",
    "<skill_files>",
    ...files.map((file) => `<file>${file}</file>`),
    "</skill_files>",
    "</skill_content>",
  ].join("\n")
}
```

```ts
// packages/core/src/skill.ts:55
export const prepare = Effect.fn("Skill.prepare")(function* (fs: FSUtil.Interface, skill: Info) {
  const directory = path.dirname(skill.path)
  const files =
    path.basename(skill.path) === "SKILL.md"
      ? (yield* fs.scan("**/*", { cwd: directory, absolute: true, include: "file", dot: true }))
          .filter((file) => path.basename(file) !== "SKILL.md")
          .toSorted()
          .slice(0, 10)
      : []
  return {
    directory,
    output: toModelOutput(skill, files),
  }
})
```

What to notice:

- The catalog advertises only id, name, and description; the body is never in the prompt.
- `Skill.available` filters by the `skill` permission action and the id
  (`permission.evaluate("skill", skill.id, permissions)`), so a denied skill is invisible.
- `toSorted` makes the catalog byte-stable; the file list is sampled (ten, sorted) so a skill
  directory with hundreds of files does not flood the result.
- `prepare` only scans files when the entry file is literally `SKILL.md`; otherwise it reports
  no files.

### The prompts

The catalog render, `packages/core/src/skill/instructions.ts:25`, verbatim:

```text
Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
The user may also invoke a skill directly. When that happens, its instructions appear in the conversation as a <skill_content> block, the same shape the skill tool returns. A skill that is already present this way does not need to be invoked again.
<available_skills>
  <skill>
    <id>...</id>
    <name>...</name>
    <description>...</description>
  </skill>
</available_skills>
```

The third line is load-bearing: it tells the model that a skill may already be in the
conversation because the *user* invoked it, and that it should not be fetched twice — which is
what keeps a user-invoked skill from producing a redundant second copy.

The on-demand block, `packages/core/src/skill.ts:36`, verbatim (with the body elided):

```text
<skill_content name="...">
# Skill: ...

…
Base directory for this skill: /path/to/skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/path/to/skill/scripts/run.sh</file>
</skill_files>
</skill_content>
```

The base-directory line is the subtle part: without it, a skill that says "run `scripts/run.sh`"
would have the model guess the path. The file list is marked sampled so the model does not
infer completeness.

### Build it

```ts
function catalogSource(skills, permissions): InstructionSource {
  const available = skills
    .filter(s => permissionEffect("skill", s.id) !== "deny")
    .filter(s => s.description !== undefined && s.autoinvoke !== false)
    .map(s => ({ id: s.id, name: s.name, description: s.description }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return makeSource("core/skill-guidance", available, {
    render: renderCatalog,
    update: smallDeltaOrRestate,
  })
}

function loadSkill(id): ToolResult {
  const skill = skills.get(id) ?? fail("Unable to load skill " + id)
  permission.assert({ action: "skill", resources: [skill.id] })
  const files = basename(skill.path) === "SKILL.md" ? sampleFiles(dirname(skill.path), 10) : []
  return skillContent(skill, files)
}
```

Design notes: keep the catalog small and stable — it is cache-prefix material. Restate the
whole catalog on any change *except* pure additions and removals, because a delta over a
partially changed list is easy for the model to misread. Sample the file list rather than
enumerating it.

### How it fails

- **Redundant fetch.** Without the "already present" sentence, a user-invoked skill gets fetched
  again by the tool, duplicating context.
- **Leaked denied skill.** If the catalog did not filter by permission, the model would be told
  to load a skill whose tool call then fails authorization.
- **Unstable catalog order.** Unsorted entries change the baseline hash whenever the skill map
  is rebuilt, forcing deltas.
- **Huge file list.** Enumerating a deep skill directory inflates the tool result far beyond the
  body itself.

### How you'd test it

Deny a skill's id and assert the catalog omits it. Invoke the skill tool for an available skill
and assert the returned content contains `<skill_content`, the skill name, and the base
directory. Then add and remove a skill and assert the catalog update renders as a small delta
in each case, and that a description change restates the whole catalog.

### Recap

- Skills are advertised as a compact catalog (id, name, description) and fetched on demand.
- Availability is permission-filtered, described, and auto-invoked; the catalog is sorted for
  stable bytes.
- The fetched `<skill_content>` carries the body, base directory, and a sampled file list.

Next: MCP, which contributes both an instruction block and a tool source.

### Podcast notes

**Hook:** A hundred skills fit in the prompt because the prompt only carries their names.
**Analogy:** A library card catalog: you see titles and blurbs; you only walk to the shelf for the book you actually want.
**Talking points:** The catalog is an instruction source that delta-updates; the body is a tool result. Permission filtering happens before the model ever sees a name. The base directory is what makes relative scripts in a skill usable.
**Listeners will ask:** How does the model know a user already invoked a skill?

---

## 4.6 MCP

### Thesis

An MCP server contributes a dynamic instruction block *and* a tool source; the block is
rendered for a server only when the session can actually reach at least one of that server's
tools, so the prompt never tells the model to use tools it cannot call.

### Cold open

An MCP server advertises a search tool with its own usage notes, and the notes land in the
prompt. Then the server's tools are denied by permission — but the notes are still there,
instructing the model to use tools it cannot call. The instruction block and the tool gate
have to agree.

### The concept

Model Context Protocol (MCP) servers expose two things to the agent: a short block of
natural-language instructions describing how to use the server, and a set of tools. opencode
turns the instructions into an instruction source keyed `core/mcp-guidance`, and the tools into
a tool source installed under a stable transform (Part 5.8).

The gating rule is the important design. A server's instruction block is included only if the
session can reach at least one of its tools:

- If the server's tools are exposed through CodeMode (the default), the session must be able
  to call `execute` at all — the server's `tools[...]` entry is reachable only through code.
- If the server is out of CodeMode (`codemode: false`), the block is included only if at least
  one of the server's tools is not denied by permission.

The block itself is `<mcp_instructions>` containing one `<server name="...">` per server. In
CodeMode, each server block gains a line naming the `tools["<namespace>"]` path the model
should call through. Servers are sorted by name for stable bytes, and an empty visible set
becomes `Instructions.removed`.

Deltas follow the shared pattern: additions and removals render as small deltas; a change to a
server's instructions (or its CodeMode flag) restates the whole block.

The rejected alternative is to emit instructions for every configured server regardless of
reachability. That is simpler and actively harmful: the model is prompted to call tools that
will fail authorization, wasting a step and producing a category of error the prompt itself
created.

### Diagram

**D26 — MCP instruction block and tool source.** Server instructions and server tools are read
from the same MCP service; the reachability filter decides whether the block is visible.

```mermaid
flowchart TD
  MCP[Mcp.Service] --> INS["mcp.instructions()"]
  MCP --> TOOLS["mcp.tools()"]
  INS --> VIS
  TOOLS --> VIS
  PERM[permissions] --> VIS
  VIS["per server:<br/>codemode? need 'execute':<br/>native? need >=1 allowed tool"] --> BLOCK["<mcp_instructions> ... </mcp_instructions>"]
  BLOCK --> SRC["source 'core/mcp-guidance'"]
  TOOLS --> NST["McpTool.namespace(server) tool transform"]
  NST --> REG[tool registry]
  REG --> SNAP[tool snapshot in Selection]
```

```text
  Mcp.Service
     ├── instructions() ─┐
     └── tools() ────────┤
                         v
             reachability filter (permissions)
               codemode server: can execute?
               native server:   >=1 tool not denied?
                         |
                         v
     <mcp_instructions> with per-server blocks  -> source "core/mcp-guidance"
     tools -> McpTool.namespace(server) -> registry -> snapshot
```

**Narration.** The MCP service supplies both server instructions and server tools. For each
server, a permission check decides whether its instruction block is visible: a code-mode server
needs the ability to run `execute`; a native server needs at least one allowed tool. Visible
blocks go into the instruction source; the tools themselves go through the MCP tool transform
into the registry and, from there, into the tool snapshot.

### The real thing

```ts
// packages/core/src/mcp/instructions.ts:17
const entries = (servers: ReadonlyArray<Summary>) =>
  servers.flatMap((server) => {
    const result = [`  <server name="${server.server}">`]
    if (server.codemode !== false)
      result.push(
        `    Use tools from this server through \`execute\` under \`tools[${JSON.stringify(McpTool.namespace(server.server))}]\`.`,
      )
    result.push(...server.instructions.split("\n").map((line) => `    ${line}`), "  </server>")
    return result
  })

const render = (servers: ReadonlyArray<Summary>) =>
  ["<mcp_instructions>", ...entries(servers), "</mcp_instructions>"].join("\n")
```

```ts
// packages/core/src/mcp/instructions.ts:69
      load: Effect.fn("McpInstructions.load")(function* (permissions) {
        const source = (value: ReadonlyArray<Summary> | Instructions.Removed) =>
          Instructions.make<ReadonlyArray<Summary>>({
            key: Instructions.Key.make("core/mcp-guidance"),
            codec: Schema.toCodecJson(Schema.Array(Summary)),
            read: Effect.succeed(value),
            render: {
              initial: render,
              changed: update,
              removed: () => "MCP server instructions are no longer available.",
            },
          })
        const [instructions, tools] = yield* Effect.all([mcp.instructions(), mcp.tools()], {
          concurrency: "unbounded",
        })
        const canExecute = Permission.evaluate("execute", "*", permissions).effect !== "deny"
        // Instructions are useful only when this Session can reach at least one server tool.
        const visible = instructions
          .flatMap((item) => {
            const owned = tools.filter((tool) => tool.server === item.server)
            const codemode = owned[0]?.codemode !== false
            if (codemode && !canExecute) return []
            if (
              !owned.some(
                (tool) =>
                  Permission.evaluate(McpTool.name(tool.server, tool.name), "*", permissions).effect !== "deny",
              )
            )
              return []
            return [
              codemode
                ? { server: item.server, instructions: item.instructions }
                : { server: item.server, instructions: item.instructions, codemode: false as const },
            ]
          })
          .toSorted((a, b) => a.server.localeCompare(b.server))
        return source(visible.length === 0 ? Instructions.removed : visible)
      }),
```

What to notice:

- The `canExecute` check evaluates the `execute` action with resource `*` — code-mode servers
  are unreachable when `execute` is denied, even if the individual tools are allowed.
- A native server is visible only if at least one of its tools passes `McpTool.name` evaluation;
  the whole server disappears otherwise.
- The block is sorted by server name and maps an empty set to `Instructions.removed`, matching
  the skill and discovery sources.
- The `codemode` flag is carried in the summary so the rendered block knows to add the
  `tools[...]` line, and the tool source (Part 5.8) is what actually makes those names callable.

### The prompts

The MCP block, `packages/core/src/mcp/instructions.ts:28`, verbatim (with one server elided):

```text
<mcp_instructions>
  <server name="...">
    Use tools from this server through `execute` under `tools["..."]`.
    ...server instructions...
  </server>
</mcp_instructions>
```

The `tools["<namespace>"]` line is the CodeMode bridge: it tells the model the exact path under
which this server's tools appear in the code-mode catalog, which is how the model knows to call
them through `execute` rather than as direct tool calls. The block's design mirrors the
CodeMode preamble in `packages/core/src/codemode/instructions.ts:8`, which frames the `execute`
tool and the catalog. Both are quoted in full in Appendix A under **Tools**.

### Build it

```ts
function mcpSource(permissions): InstructionSource {
  const [instructions, tools] = [mcp.instructions(), mcp.tools()]
  const canExecute = permissionEffect("execute", "*") !== "deny"
  const visible = instructions.flatMap(server => {
    const owned = tools.filter(t => t.server === server.server)
    const codemode = owned[0]?.codemode !== false
    if (codemode && !canExecute) return []
    if (!owned.some(t => permissionEffect(nsName(t)) !== "deny")) return []
    return [{ ...server, codemode }]
  }).sort((a, b) => a.server.localeCompare(b.server))
  return makeSource("core/mcp-guidance", visible.length ? visible : REMOVED, {
    render: renderMcpBlock,
    update: smallDeltaOrRestate,
  })
}
```

Design notes: derive the instruction block's visibility from the same permission evaluation that
gates the tools, so the two cannot disagree. Sort deterministically. Because MCP tools can
appear and disappear as a server reconnects, treat the tool source as mutable and re-derive the
snapshot at selection time rather than caching server state in the prompt.

### How it fails

- **Orphaned instructions.** If the block is emitted for a server whose tools are all denied,
  the model is coached into a call that fails authorization — the prompt creates the error.
- **CodeMode mismatch.** A server rendered with the `tools[...]` line while the session cannot
  call `execute` is similarly misleading.
- **Non-deterministic order.** Sorting by connection order instead of name churns the baseline
  and forces deltas when servers reconnect.
- **Stale tool source.** If server tools are re-registered at the end of the transform order,
  a later plugin override is clobbered; MCP instead owns one stable transform updated in place.

### How you'd test it

Deny every tool of a server and assert the block is absent (or the source is `removed`). Deny
`execute` for a code-mode server and assert the same. Add a server and assert the update renders
a small delta naming it; change a server's instructions and assert the whole block restates.

### Recap

- MCP contributes both a dynamic instruction block and a tool source.
- A server's block is visible only when the session can reach at least one of its tools (or can
  call `execute` for a code-mode server).
- The block is sorted, delta-updates like other instruction sources, and names the
  `tools["<namespace>"]` path in CodeMode.

Next: lowering the assembled history into provider messages.

### Podcast notes

**Hook:** A prompt that tells the model to use a server whose tools were denied is a prompt that manufactures failures.
**Analogy:** A phone list that only includes people you are actually allowed to call — otherwise you keep dialing numbers that never connect.
**Talking points:** Instructions and tools come from the same service and are gated by the same permissions. Code mode changes the reachability test to "can you execute." The block is just another delta-updating instruction source.
**Listeners will ask:** What happens when an MCP server disconnects mid-session?

---

## 4.7 Lowering: `toLLMMessages`

### Thesis

Lowering translates one projected Session message into zero or more provider messages, bounding
images, dropping metadata that is not replayable, and choosing safe representations after a
model or provider switch.

### Cold open

You switch from model A to model B mid-session. The transcript still holds A's encrypted
reasoning and thought signatures. Replaying them to B is at best a provider error and at worst
a silent lie: B is handed proof-of-generation it did not produce. Lowering has to know which
bytes are model-scoped proof and which are portable content.

### The concept

A projected Session message is not the same shape as a provider message. One assistant Message
carries many content items — text, reasoning, and tool calls — and lowering can explode it into
several provider messages: a single assistant message with its text and reasoning, followed by
separate tool-result messages. Some messages lower to nothing at all.

The mapping is per type:

- `assistant` — text and reasoning become content parts; tool calls and tool results become
  tool-call and tool-result parts. Only tool results for tools the *agent* ran (`executed !==
  true`) become separate messages; provider-executed (hosted) tool results ride along with their
  call.
- `user` — text, attached files, and skills inlined as content parts.
- `synthetic`, `skill`, `shell`, `location-switched`, `system`, `compaction` — each has a fixed
  rendering; `idle` and `agent-switched` lower to nothing.
- `model-switched` — lowers to an effort-change message *only* when both the from and to
  variants are reasoning-effort variants on the same provider and model.

Three reuse rules govern provider metadata, and they are the subtle part:

1. **Text metadata** (e.g. Gemini thought signatures) is replayed only when the target is the
   *same model* and the message has no error.
2. **Reasoning** is replayed as reasoning only when metadata is reusable *and* the reasoning was
   not interrupted (its `time.completed` is set). After a model or provider switch, readable
   reasoning is downgraded to plain *text* so the destination can still see it, and reasoning
   with no readable text is dropped.
3. **Tool metadata** has a *call side* and a *result side*. Call-side `providerState` is
   model-scoped proof and replays only for the producing model (or a completed/errored hosted
   tool of the same model). Result-side `providerResultState` for a hosted tool is
   provider-format payload, not proof, so it stays replayable across *models of the same
   provider* — but after a model switch only that payload is echoed, never the call-side state.

Attachments are lowered by MIME type: `text/plain` is inlined with a header, a directory is
listed, images and PDFs become base64 media (with a location line when the source is a `file:`
URI), and anything else is dropped. When several inline images share the same mention, name,
description, and MIME, duplicates are removed so the same image is not sent twice for one
mention.

Before the request is built, two model-aware normalizations run. `unsupportedParts` replaces
media the target model cannot accept (or that a provider, like xAI, rejects for its type) with
an explanatory text part, so a request never fails because a transcript carries a format the
model does not support. `boundImages` measures the total inline image bytes and, above a
trigger, replaces the *oldest-first* images with a marker until the total drops below a target,
so one large screenshot does not blow the request size.

The rejected alternative is to replay everything and let the provider reject it. That turns a
correctness question ("is this metadata valid here?") into a per-provider error taxonomy the
agent would have to retry around.

### Diagram

**D27 — lowering decision state machine.** One Session message branches by type and, for
assistant content, by whether the target model can replay the stored metadata.

```mermaid
stateDiagram-v2
  [*] --> Select: one Session message
  Select --> Nothing: idle / agent-switched
  Select --> Assistant: assistant
  Select --> UserMsg: user / synthetic / skill / shell / system / location-switched / compaction
  Assistant --> SameModel: target.model == message.model and no error
  Assistant --> CrossModel: otherwise
  SameModel --> KeepAll: text+reasoning+call+result metadata kept
  CrossModel --> Textify: reasoning -> text (if readable), else dropped
  CrossModel --> DropCallMeta: call-side providerState dropped
  CrossModel --> ResultMeta: hosted result payload kept only if same provider
  UserMsg --> Parts: text/files/skills -> content parts
  Parts --> Normalize: unsupportedParts -> boundImages
  KeepAll --> Normalize
  Textify --> Normalize
  DropCallMeta --> Normalize
  ResultMeta --> Normalize
  Normalize --> [*]: provider Message[]
```

```text
  Session message
    |- idle / agent-switched          -> [] (nothing)
    |- assistant                      -> assistant(...)
    |    sameModel && no error?  keep text/reasoning/call metadata
    |    else:
    |       reasoning -> "reasoning" if readable & not interrupted, else text, else drop
    |       call-side providerState -> drop
    |       hosted result payload -> keep only if same provider
    |- user/synthetic/skill/shell/... -> fixed content
    |- model-switched                 -> effort message only if same p/m & variants
    |- compaction                     -> native decode OR <conversation-checkpoint>
                                       |
                                       v
                       unsupportedParts(messages, capabilities, provider)
                                       |
                                       v
                       boundImages(messages)  (drop oldest > 25MiB -> 15MiB)
                                       |
                                       v
                                   LLMRequest.messages
```

**Narration.** A Session message enters, and idle or agent-switched messages fall away with no
output. An assistant message is the hard case: if the target model is the same one that
produced it and there was no error, its metadata is kept verbatim; otherwise reasoning becomes
text where it can be read, call-side proof is dropped, and only hosted-tool result payloads
survive within the same provider. Everything then passes through the two model-aware
normalizations — replacing unsupported media and bounding oversized images — before the request
is sent.

### The real thing

```ts
// packages/core/src/session/runner/to-llm-message.ts:153
const assistant = (message: SessionMessage.Assistant, model: Model.Ref, providerMetadataKey: string) => {
  const sameProvider = String(message.model.providerID) === String(model.providerID)
  const sameModel = sameProvider && String(message.model.id) === String(model.id)
  const reuseProviderMetadata = sameModel && message.error === undefined
  const reasoningInterrupted = message.content.some(
    (item) => item.type === "reasoning" && item.time !== undefined && item.time.completed === undefined,
  )
  const content = message.content.flatMap((item): ContentPart[] => {
    if (item.type === "text")
      return [
        {
          type: "text",
          text: item.text,
          // Text can carry provider-bound state (e.g. Gemini thought signatures),
          // which is only replayable against the model that produced it.
          providerMetadata: reuseProviderMetadata ? providerMetadata(providerMetadataKey, item.state) : undefined,
        },
      ]
    // Let the destination adapter handle readable reasoning after a model/provider switch.
    if (item.type === "reasoning")
      return reuseProviderMetadata && !reasoningInterrupted
        ? [
            {
              type: "reasoning",
              text: item.text,
              providerMetadata: providerMetadata(providerMetadataKey, item.state),
            },
          ]
        : item.text.length > 0
          ? [{ type: message.error === undefined && !reasoningInterrupted ? "reasoning" : "text", text: item.text }]
          : []
    // Call-side metadata is model-scoped proof of generation (Gemini thought
    // signatures, OpenAI encrypted reasoning): only the producing model may
    // replay it.
    const reuseToolProviderMetadata =
      reuseProviderMetadata ||
      (sameModel && item.executed === true && (item.state.status === "completed" || item.state.status === "error"))
    const call = toolCall(
      item,
      reuseToolProviderMetadata ? providerMetadata(providerMetadataKey, item.providerState) : undefined,
    )
    if (item.executed !== true) return [call]
    // Hosted tools (e.g. google_search) run inside the provider, so their
    // result payload (`providerResultState`) is provider-format data rather
    // than model-scoped proof: it stays replayable across models of the same
    // provider. After a model switch, echo only that payload — never fall
    // back to `providerState`, whose call-side values are bound to the old
    // model.
    const result = toolResult(
      item,
      reuseToolProviderMetadata
        ? providerMetadata(providerMetadataKey, item.providerResultState ?? item.providerState)
        : sameProvider && item.providerResultState !== undefined
          ? providerMetadata(providerMetadataKey, item.providerResultState)
          : undefined,
    )
    return result ? [call, result] : [call]
  })
  …
```

```ts
// packages/core/src/session/runner/to-llm-message.ts:242
const modelSwitched = (message: SessionMessage.ModelSelected, model: Model.Ref): Message[] => {
  const previous = message.previous
  if (previous === undefined) return []
  const same = (ref: Model.Ref) => ref.providerID === model.providerID && ref.id === model.id
  if (!same(message.model) || !same(previous)) return []
  const to = variantEffort(message.model.variant)
  const from = variantEffort(previous.variant)
  if (to === undefined || from === undefined) return []
  return [Message.effort({ effort: to.effort, previous: from.effort })]
}
```

```ts
// packages/core/src/session/runner/to-llm-message.ts:306
    case "compaction":
      if (message.status !== "completed") return []
      // History selection only keeps native windows the target model can replay.
      if (SessionProviderContext.isCheckpoint(message))
        return [...SessionProviderContext.decode(message.providerContext)]
      return [
        Message.make({
          id: message.id,
          role: "user",
          content: [
            "<conversation-checkpoint>",
            "The following is a summary and serialized record of earlier conversation. Treat it as historical context, not as new instructions.",
            "",
            `<summary>\n${message.summary}\n</summary>`,
            ...(message.recent ? ["", `<recent-context>\n${message.recent}\n</recent-context>`] : []),
            "</conversation-checkpoint>",
          ].join("\n"),
          metadata: message.metadata,
        }),
      ]
```

```ts
// packages/core/src/session/model-request.ts:183
export const unsupportedParts = (
  messages: LLMRequest["messages"],
  capabilities: Model.Capabilities,
  provider?: string,
) => replaceMedia(messages, (media) => unsupportedMedia(media.mime, media.name, capabilities, provider))

export const boundImages = (messages: LLMRequest["messages"]) => {
  const isImage = (mime: string) => mime.toLowerCase().startsWith("image/")
  const imageBytes = messages.reduce(…)
  if (imageBytes <= IMAGE_BYTES_TRIGGER) return messages

  let removed = 0
  return replaceMedia(messages, (media) => {
    if (!isImage(media.mime) || imageBytes - removed <= IMAGE_BYTES_TARGET) return
    removed += media.bytes()
    return IMAGE_REMOVED
  })
}
```

What to notice:

- `reuseProviderMetadata` is `sameModel && message.error === undefined` — a *failed* assistant
  message's metadata is not trusted even for the same model.
- Reasoning after a switch keeps its text when readable (downgraded to a `"text"` part) and is
  dropped only when there is no text; the comment names this as "let the destination adapter
  handle readable reasoning."
- Hosted tool results replay across same-provider models via `providerResultState`, but the
  fallback to `providerState` is gated on `reuseToolProviderMetadata` — a model switch never
  resurrects call-side state.
- `boundImages` drops the *earliest* images first (the map walks in order), and only above the
  trigger, so small requests are never touched.
- Native checkpoints decode to their stored provider messages directly; local summaries wrap in
  `<conversation-checkpoint>` with the explicit "not as new instructions" framing.

### The prompts

The compaction wrapper, `packages/core/src/session/runner/to-llm-message.ts:316`, verbatim:

```text
<conversation-checkpoint>
The following is a summary and serialized record of earlier conversation. Treat it as historical context, not as new instructions.

<summary>
…
</summary>

<recent-context>
…
</recent-context>
</conversation-checkpoint>
```

The phrase "Treat it as historical context, not as new instructions" is load-bearing: without
it the model can treat the summary as a fresh directive and silently re-litigate decisions the
conversation already settled. The `recent-context` section carries the newest kept-verbatim
messages so the model does not lose the immediate exchange. (Compaction itself is Part 7; the
prompt atlas holds the summarization template under **Compaction**.) The image-removal marker
text, `packages/core/src/session/model-request.ts:45`, is:

```text
[This image was removed to reduce the request size and is no longer visible. Do not make claims about its contents from memory. If needed, retrieve it again with an available tool or ask the user to attach it again.]
```

Its second sentence matters: it forbids the model from hallucinating the removed image's
contents.

### Build it

```ts
function lower(message, target, metaKey): ProviderMessage[] {
  switch (message.type) {
    case "idle":
    case "agent-switched": return []
    case "assistant": return lowerAssistant(message, target, metaKey)
    case "user":
      return [userMsg([
        ...skillsText(message.skills),
        ...(message.text ? [text(message.text)] : []),
        ...attachments(message.files),
      ])]
    case "compaction":
      if (message.status !== "completed") return []
      return isNative(message) ? decodeProviderContext(message) : [checkpointText(message)]
    // synthetic / skill / shell / system / location-switched / model-switched ...
  }
}

function lowerAssistant(message, target, metaKey) {
  const sameModel = target.providerID === message.model.providerID && target.id === message.model.id
  const sameProvider = target.providerID === message.model.providerID
  const reuse = sameModel && message.error === undefined
  const parts = message.content.flatMap(item => {
    if (item.type === "text") return [textPart(item.text, reuse ? meta(item.state) : undefined)]
    if (item.type === "reasoning")
      return reuse && !interrupted(item)
        ? [reasoningPart(item.text, meta(item.state))]
        : item.text ? [readableReasoning(item.text)] : []
    // tool: call-side meta only if reuse; hosted result payload survives same provider
    …
  })
  return [assistantMsg(parts), ...agentToolResults(message)]
}

function normalize(messages, target) {
  return boundImages(unsupportedParts(messages, target.capabilities, target.provider))
}
```

Design notes: decide a single `reuse` flag up front and derive every metadata decision from it,
so text, reasoning, and call-side metadata cannot disagree. Keep the result-side payload
(provider-run tools) separate from the call side, because result payloads are portable within a
provider and call-side proof is not. Bound images before sending, and always leave a marker
explaining what was removed.

### How it fails

- **Replaying foreign proof.** Sending another model's thought signatures or encrypted reasoning
  causes provider errors or, worse, the destination trusting state it should not.
- **Losing reasoning entirely.** Dropping readable reasoning on a switch removes continuity the
  model could still use; downgrading it to text preserves it.
- **Empty assistant.** If every part filters out, lowering returns only the tool results (or
  nothing), which is correct — but a renderer that emits an empty assistant message confuses
  providers that reject empty content.
- **Image blowup.** A single oversized request fails at the provider; bounding avoids the failure
  but must mark the removal so the model does not fabricate.
- **Checkpoint leakage.** Feeding a native window to a model that cannot replay it corrupts the
  transcript; history selection filters these out, and `prepare` dies if a route hook would
  change the target after selection.

### How you'd test it

Lower one assistant message twice: once with the producing model (assert provider metadata is
present) and once with a different model (assert text metadata is absent, call-side state is
absent, and reasoning is present as text when readable). Build a request with total image bytes
over 25 MiB and assert the earliest images become the removal marker until the total is under
15 MiB. Lower a native checkpoint and assert its stored provider messages come back verbatim.

### Recap

- Lowering maps one Session message to zero or more provider messages and drops messages that
  have no model-visible form.
- Provider metadata is replayed only where it is valid: text and reasoning for the same model,
  call-side proof for the producing model, result payloads across same-provider models.
- Unsupported media is replaced with explanatory text and oversized images are bounded, so a
  request never fails on shape.

Next: agents, which supply the system prompt, permissions, and step limit that all of this
assembles around.

### Podcast notes

**Hook:** Switching models mid-conversation is fine — until you hand the new model the old model's encrypted reasoning.
**Analogy:** Customs: some goods travel freely within a country (same-provider result payloads), others need the original stamp of the exact issuer (thought signatures).
**Talking points:** One Session message can become several provider messages or none. The reuse flag is the whole safety story for provider metadata. Bounding images is a correctness fix, not just a size fix, because of the marker text.
**Listeners will ask:** Why keep a hosted tool's result after a model switch if you drop its call metadata?

---

## 4.8 Agents

### Thesis

An agent is a named bundle — system prompt, model, permissions, mode, and step limit — selected
per session; selection resolves the default by configured default, then `build`, then the first
selectable primary agent, and its permissions merge with the session's to narrow instructions
and tools.

### Cold open

A user runs a helper subagent and it appears in the default-agent list; or a hidden internal
agent becomes the one a fresh session picks. Selection and the default-resolution rule are what
keep an internal roster from leaking into the user's face and keep subagents from being
selected as a primary.

### The concept

An **agent** (`Agent.Info`) is a bundle:

- `id`, `name` — identity.
- `model?` — a preferred model reference; when omitted the session's model resolves instead.
- `request` — provider request settings (headers, body, settings).
- `system?` — a full system-prompt override; when present it replaces the generated base prompt.
- `description?` — shown when the agent is offered as a subagent.
- `mode` — `primary`, `subagent`, or `all`.
- `hidden` — whether it is excluded from user-facing selection.
- `steps?` — a maximum step count for one execution with this agent.
- `permissions` — a ruleset.

The default constructor (`Agent.Info.default`) makes a primary agent with an allow-all ruleset
plus explicit `ask` rules for reading `.env` files (and an `allow` for `.env.example`), which is
a safe starting point rather than a blank policy.

**Selection versus resolution.** `select(id)` returns `{ id, info }` for an explicit id (with
`info` possibly undefined, which the caller turns into an error), and for no id returns the
resolved default. `resolve(id)` returns the `Info` or the default's `Info`. `list()` returns all
agents but puts the currently selected one first, so a UI shows the active agent at the top.

**Default resolution** is ordered and filtered by `selectable`:

1. The configured default (`default_agent`), if it is selectable.
2. The `build` agent, if selectable.
3. The first agent in the map that is selectable.

`selectable` means the agent exists, its mode is not `subagent`, and it is not `hidden`. This is
why subagents and hidden internals never become the session default.

**Configuration** arrives through the config agent plugin: a configured `default_agent` sets the
default; repository-wide permission rules are pushed onto every existing agent; each per-agent
entry can set `model`, `request`, `system`, `description`, `mode`, `hidden`, `color`, `steps`,
`permissions`, or `disabled` (which removes the agent). Legacy `.md` agents under
`{agent,agents,mode,modes}` are migrated into the same shape.

**How the rest of assembly uses an agent.** `select` merges the agent's permissions with the
session's (`Permission.merge(agent.info.permissions, session.permissions ?? [])`) and uses the
merged ruleset to narrow instruction sources, the skill catalog, MCP visibility, and the tool
snapshot. The step limit is enforced in the runner: `loaded.agent.info.steps` bounds how many
steps one execution may run, and at the limit the request is sent with `toolChoice: "none"` plus
a step-limit reminder (so the model summarizes instead of calling tools). For subagents, the
child's model resolves as explicit model > agent model > parent model, and a depth limit stops
recursion.

The rejected alternative is a single global agent configuration. Per-agent bundles let the same
session runtime switch between a build agent, a planning agent, and hidden internal agents with
different permissions and prompts, without the caller re-specifying the whole policy each time.

### Diagram

**D28 — agent selection and default resolution.** An explicit id short-circuits to that agent;
no id runs the ordered default resolution, filtered so subagents and hidden agents cannot be
chosen. The chosen agent's permissions merge with session permissions and flow into selection.

```mermaid
flowchart TD
  Q["select(id?)"] -->|id given| A["lookup id -> { id, info? }"]
  Q -->|no id| DEF["selectedDefault()"]
  DEF --> R1["configured default? selectable?"]
  R1 -->|no| R2["agent 'build'? selectable?"]
  R2 -->|no| R3["first selectable agent"]
  R1 -->|yes| SEL
  R2 -->|yes| SEL
  R3 --> SEL
  A --> SEL["Selection.agent"]
  SEL --> MERGE["Permission.merge(agent.permissions, session.permissions)"]
  MERGE --> NARROW["narrow instructions / skills / MCP / tool snapshot"]
  SEL --> STEPS["agent.steps -> step limit (toolChoice none)"]
```

```text
  select(id?)
    |
    +-- id given --> lookup(id) -> { id, info }  (info undefined -> AgentNotFoundError)
    |
    +-- no id --> selectedDefault()
                   1. configured default_agent (selectable?)
                   2. "build" (selectable?)
                   3. first selectable agent
                 selectable = exists && mode != "subagent" && !hidden
    |
    v
  Selection.agent
    |
    +--> Permission.merge(agent.permissions, session.permissions)
    |       -> narrow instruction sources, skills, MCP, tool snapshot
    +--> agent.steps -> step limit at which the runner sends toolChoice: "none"
    +--> agent.system? -> replaces the generated base prompt
```

**Narration.** Selection either takes an explicit id, which resolves directly, or resolves the
default by trying the configured default, then `build`, then the first selectable agent —
skipping subagents and hidden agents at every step. The chosen agent's permissions merge with
the session's and narrow everything selection assembles; its step limit bounds the execution and
forces a tool-free summary at the limit.

### The real thing

```ts
// packages/schema/src/agent.ts:22
export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  name: Name,
  model: Model.Ref.pipe(optional),
  request: Provider.Request,
  system: Schema.String.pipe(optional),
  description: Schema.String.pipe(optional),
  mode: Schema.Literals(["subagent", "primary", "all"]),
  hidden: Schema.Boolean,
  color: Color.pipe(optional),
  steps: PositiveInt.pipe(optional),
  permissions: Permission.Ruleset,
})
  .annotate({ identifier: "Agent.Info" })
  .pipe(
    statics(() => ({
      default: (id: ID) =>
        ({
          id,
          name: Name.make(id),
          request: { settings: {}, headers: {}, body: {} },
          mode: "primary",
          hidden: false,
          permissions: [
            { action: "*", resource: "*", effect: "allow" },
            { action: "read", resource: "*.env", effect: "ask" },
            { action: "read", resource: "*.env.*", effect: "ask" },
            { action: "read", resource: "*.env.example", effect: "allow" },
          ],
        }) satisfies Info,
    })),
  )
```

```ts
// packages/core/src/agent.ts:74
    const selectable = (agent: Info | undefined) =>
      agent && agent.mode !== "subagent" && !agent.hidden ? agent : undefined
    const selectedDefault = () => {
      const data = state.get()
      const configured = data.default ? selectable(data.agents.get(data.default)) : undefined
      if (configured) return configured
      const build = selectable(data.agents.get(ID.make("build")))
      if (build) return build
      for (const agent of data.agents.values()) {
        const fallback = selectable(agent)
        if (fallback) return fallback
      }
    }

    return Service.of({
      …
      select: Effect.fn("Agent.select")(function* (id) {
        if (id !== undefined) {
          const selected = ID.make(id)
          return { id: selected, info: state.get().agents.get(selected) }
        }
        const info = selectedDefault()
        return { id: info?.id ?? defaultID, info }
      }),
      list: Effect.fn("Agent.list")(function* () {
        const agents = Array.fromIterable(state.get().agents.values())
        const selected = selectedDefault()
        if (!selected) return agents
        return [selected, ...agents.filter((agent) => agent.id !== selected.id)]
      }),
    })
```

```ts
// packages/core/src/session/context.ts:128
      const agent = yield* agents.select(session.agent)
      if (!agent.info) return yield* new AgentNotFoundError({ sessionID: session.id, agent: session.agent ?? agent.id })
      // Session permissions narrow discovery the same way they narrow the tool snapshot.
      const permissions = Permission.merge(agent.info.permissions, session.permissions ?? [])
```

```ts
// packages/core/src/config/plugin/agent.ts:88
      const configuredDefault = Config.latest(loaded.documents, "default_agent")
      if (configuredDefault !== undefined) editor.default(Agent.ID.make(configuredDefault))
      for (const current of editor.list()) {
        editor.update(current.id, (agent) => agent.permissions.push(...permissions))
      }
      …
          if (item.model !== undefined)
            agent.model = {
              id: item.model.model,
              providerID: item.model.providerID,
              ...(item.model.variant === undefined ? {} : { variant: item.model.variant }),
            }
          …
          if (item.steps !== undefined) agent.steps = item.steps
          if (item.permissions !== undefined) {
            agent.permissions.push(...expandPermissions(item.permissions, global.home))
          }
```

```ts
// packages/core/src/session/runner/llm.ts:226
        const stepLimitReached = loaded.agent.info.steps !== undefined && step >= loaded.agent.info.steps
        …
          // Keep tool definitions on the final Step to preserve the provider's cached prefix.
          toolChoice: stepLimitReached ? "none" : undefined,
```

What to notice:

- `selectable` is the single gate: a subagent or hidden agent can never be the resolved default,
  but an explicit id still resolves it (so the subagent tool can reach subagents).
- `select` with no id falls back to `id: defaultID` (`"build"`) even when no agent is selectable,
  leaving `info` undefined — the caller (`select` in context) then raises `AgentNotFoundError`.
- The default constructor's env rules show how permissions compose: a broad allow, then narrow
  `ask`s that win because the last matching rule wins.
- The config plugin pushes repository-wide permission rules onto every agent *and* applies
  per-agent overrides, including `disabled`, which removes the agent entirely.

### The prompts

No prompts in this topic — the maximum-steps prompt and the subagent framing live in Appendix A
under **Loop** and **Tools**.

### Build it

```ts
type Agent = {
  id: string; name: string
  model?: ModelRef; request: RequestSettings
  system?: string; description?: string
  mode: "primary" | "subagent" | "all"
  hidden: boolean; steps?: number; permissions: Rule[]
}

function selectable(a?: Agent): Agent | undefined {
  return a && a.mode !== "subagent" && !a.hidden ? a : undefined
}

function selectedDefault(agents: Map<string, Agent>, configured?: string): Agent | undefined {
  return (configured && selectable(agents.get(configured)))
    ?? selectable(agents.get("build"))
    ?? [...agents.values()].find(selectable)
}

function select(agents, id?: string): Selection {
  if (id !== undefined) return { id, info: agents.get(id) }
  const info = selectedDefault(agents)
  return { id: info?.id ?? "build", info }
}

// in context select:
const agent = select(agents, session.agent)
if (!agent.info) throw new AgentNotFoundError(session.id, session.agent ?? agent.id)
const permissions = merge(agent.info.permissions, session.permissions)
```

Design notes: filter *inside* the default walk, not after, so a configured default that is a
subagent cannot slip through. Keep the agent's `system` as a full replacement, not a patch — a
partial override invites accidental duplication of the base prompt. Apply permissions by merge
and let the ruleset's last-match-wins ordering do the precedence work.

### How it fails

- **No selectable agent.** If every configured agent is a subagent or hidden, `select` returns
  `{ id: "build", info: undefined }` and context assembly raises `AgentNotFoundError`, failing
  the step rather than silently sending an unconfigured prompt.
- **Subagent as default.** Without the `selectable` filter, a helper subagent with no explicit
  mode could become the session default and appear to the user as the main agent.
- **Permission leak.** If the session's *narrowing* permissions were dropped and only the agent
  ruleset used, a session that had been restricted would regain the agent's broader permissions.
- **Unbounded steps.** Without `agent.steps`, a looping agent can run until output limits or
  interruption; the limit plus `toolChoice: "none"` forces a text-only conclusion.
- **Subagent recursion.** Without the depth limit, a subagent can spawn subagents without bound.

### How you'd test it

Assert the default-resolution order: register a configured default, a `build` agent, and a
random agent, and assert each is chosen when the prior ones are absent; mark one `hidden` or
`subagent` and assert it is skipped. Then select a session that names an unknown agent and
assert `AgentNotFoundError`. For the step limit, run an execution with `agent.steps = 1` and
assert the second request carries `toolChoice: "none"` (or that the execution ends after one
step with a text-only request).

### Recap

- An agent is a bundle of system prompt, model, permissions, mode, and step limit, selected per
  session.
- Default resolution tries the configured default, then `build`, then the first selectable
  agent, never selecting a subagent or hidden agent.
- The agent's permissions merge with the session's to narrow instructions and tools, and
  `agent.steps` bounds one execution, forcing a tool-free summary at the limit.

This part assembled the request; Part 5 opens up the tools the model is allowed to call, and how
they are registered, validated, and bounded.

### Podcast notes

**Hook:** The agent that answers your first message is chosen by a rule most users never see — configured default, then `build`, then whoever comes first.
**Analogy:** A restaurant's front-of-house staff: the manager's nominated host greets you, or failing that the senior server, but never the kitchen crew.
**Talking points:** A subagent is excluded from default selection but still reachable by explicit id. Permissions merge so a session can only narrow, never widen, the agent's rules. The step limit turns tools off at the end so the agent must summarize.
**Listeners will ask:** Why is `build` special-cased rather than just being the first agent?
