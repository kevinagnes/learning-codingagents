# Appendix A — Prompt atlas

Every prompt, tool description, and model-facing error string the agent embeds or sends,
verbatim, with provenance (`path:line`) and design commentary. Ground truth is the
`opencode-dev` tree at version **2.0.31**; every anchor was opened and re-checked at write
time.

Two conventions apply throughout:

- **Assembled strings.** Many of these are built by joining an array. Where a string is
  assembled, the block shows the assembled result and names the assembly site.
- **Parameterised strings.** Where a prompt takes parameters, the block shows the template
  and then a filled example.

The groups are **Harness**, **Loop**, **Compaction**, **Tools**, **Instructions**, and
**Policy**. Parts of the series own individual prompts; those topics quote only the
load-bearing fragment and link here. The full text lives only here.

---

## Harness

The harness prompts are the parts that do not depend on the conversation: the base system
prompt, the tool-dependent guidance spliced into it, an agent's own `system` override, and
the two instruction sources that describe date and environment.

### A.1 Base system prompt

Provenance: `packages/core/src/session/runner/prompt/system.txt:1-15`

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

Assembly site: the entire file is the template. Line 7 is replaced by
`SessionSystemPrompt.render` (see A.2) before the text is sent; see
`packages/core/src/session/system-prompt.ts:5-7`.

What each phrase buys:

- **"a coding agent harness"** — tells the model what kind of system it is inside, so it
  reasons about tool use rather than apologising for being a chat model.
- **"Help the user accomplish their goals"** — the standing objective. Without it the model
  optimises for answering the last message rather than finishing the task.
- **"Responses are rendered as GitHub-flavored Markdown."** — a rendering fact the model
  cannot otherwise infer. It buys correct fences, tables, and lists. Without it, output is
  plain text and the client renders literal asterisks.
- **"`<system-reminder>` blocks are harness instructions, not user-authored content. Read
  and follow them."** — this line resolves a role ambiguity. The harness delivers policy
  notes inside the user turn as `<system-reminder>` blocks; without the explicit statement
  the model may treat them as untrusted user text and ignore or argue with them.
- **"Prefer parallelizing independent tool calls."** — a behavioural nudge toward batched
  tool calls in a single step. It is the model-facing half of the loop's parallel tool
  fibers (`packages/core/src/session/runner/step.ts:103-134`); without it models serialise
  calls and waste steps.
- **Text before `# Communication` and `# Working in codebases`** — the section headers and
  the "Keep changes consistent…" line push the model toward minimal, in-style diffs, which
  reduces the number and size of review-and-revert cycles.
- **"Treat unfamiliar files or changes as potential user work…"** — the safety line. The
  model edits a working tree that may hold uncommitted user work; without this instruction
  it can clobber it. It is the prompt counterpart of the snapshot/revert machinery.

### A.2 Tool guidance interpolation (conditional lines)

Provenance: `packages/core/src/session/system-prompt.ts:9-27`; placeholder at
`packages/core/src/session/runner/prompt/system.txt:7`.

```ts
// packages/core/src/session/system-prompt.ts:9
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

The placeholder line (system.txt:7) is a bare `${OPENCODE_TOOL_GUIDANCE}`; `render`
replaces it with the joined conditional lines (or an empty string). Filled example when
`shell`, `write`, and `edit` are all present — the assembled replacement text:

```text
- Prefer dedicated tools over shell commands; fall back to the shell when a tool cannot do what you need.
- Do not chain shell commands with separators like `echo "====";` or `printf '---'`; the output becomes noisy in a way that makes the user's side of the conversation worse.
- Use the write tool to create files or completely replace their content. Prefer using the edit tool for targeted changes.
- Use the edit tool for targeted changes to existing text files. It replaces the exact text in `oldString` with `newString`, and the values must differ. By default, `oldString` must occur exactly once. If it occurs multiple times, include more surrounding context to make it unique or set `replaceAll` to true to replace every occurrence.
```

What it buys:

- **Gating on the tool name list.** `render` receives the effective names from the tool
  snapshot (`packages/core/src/session/model-request.ts:113`), so guidance for a tool that a
  given request cannot call is never sent. This keeps the system prompt a stable, reusable
  prefix and avoids teaching the model about tools it cannot use.
- **The shell-separator example.** "Do not chain shell commands with separators like
  `echo "====";`" prevents a specific, common failure: banner separators that flood the
  transcript. The clause "the output becomes noisy in a way that makes the user's side of
  the conversation worse" explains the *why*, which models follow more reliably than a bare
  prohibition.
- **The write/edit split.** These two lines steer the model to the narrow tool. Without
  them, models overuse whole-file writes and lose surrounding edits.

### A.3 Agent `system` override

Provenance: `packages/schema/src/agent.ts:28` (the field) and
`packages/core/src/session/model-request.ts:110-117` (where it is used).

```ts
// packages/schema/src/agent.ts:28
system: Schema.String.pipe(optional),
```

```ts
// packages/core/src/session/model-request.ts:110
system: [
  input.agent.system
    ? input.agent.system
    : SessionSystemPrompt.make(input.tools.definitions.map((tool) => tool.name)),
  input.initial,
]
  .filter((part) => part.length > 0)
  .map(SystemPart.make),
```

Design commentary: an agent may carry its own complete system prompt, in which case the
base prompt and the tool guidance are not sent at all; `input.initial` (the rendered
instruction baseline, see the Instructions group) is always appended. This is the seam that
lets a custom agent replace the harness voice wholesale rather than patch it. The failure
mode it prevents is a custom agent being silently prefixed by the base prompt, which would
contradict the agent author's instructions.

### A.4 Date instruction

Provenance: `packages/core/src/instructions/builtins.ts:24-32`

```ts
// packages/core/src/instructions/builtins.ts:24
Instructions.make({
  key: Instructions.Key.make("core/date"),
  codec: Schema.toCodecJson(Schema.String),
  read: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
  render: {
    initial: (date) => `Today's date: ${date}`,
    changed: (_previous, date) => `Today's date is now: ${date}`,
  },
}),
```

Filled example: `Today's date: Fri Oct 16 2026`. On the next day, the delta renders
`Today's date is now: Sat Oct 17 2026`.

Design commentary: the model has no clock. Without a date it hallucinates relative dates in
commit messages, changelogs, and file headers. The `initial`/`changed` split matters here
because a date changes daily while the rest of the baseline is stable: the `changed` render
is worded as a *supersession* ("is now"), so the model does not read two contradictory dates
with no cue about which wins.

### A.5 Environment instruction

Provenance: `packages/core/src/instructions/builtins.ts:33-53`

```ts
// packages/core/src/instructions/builtins.ts:36
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
```

Filled example (assembled `<env>` block):

```text
<env>
  Working directory: /Users/kevinagnes/Downloads/opencode-dev
  Workspace root folder: /Users/kevinagnes/Downloads/opencode-dev
  Is directory a git repo: no
  Platform: darwin
  Prefer /private/var/folders/.../T/opencode over generic system temporary directories such as /tmp; it is pre-created and approved for external access.
</env>
```

Design commentary:

- **Wrapping the block in `<env>…</env>`.** The tags make the block a single, addressable
  unit. Without them a changed environment is just more prose in history.
- **The `changed` verb "is now".** Same supersession pattern as the date; it prevents the
  model from acting on a stale working directory after a session move.
- **The temporary-directory line.** It hands the model the approved tmp path and literally
  says it "is pre-created and approved for external access", so the model writes scratch
  files somewhere the sandbox permits instead of `/tmp`. The failure it prevents is a
  permission error or a file written outside the sandbox.
- **`Platform`** is emitted as the Node value (`darwin`, `win32`, `linux`). It is kept
  because shell advice ("portable shell") is platform-dependent; the shell tool further
  humanises this in its own description (A.29).

---

## Loop

The loop prompts are injected when a step cannot proceed normally: the step limit is
reached, a stream was interrupted, or output hit the token ceiling.

### A.6 MAX_STEPS_PROMPT

Provenance: `packages/core/src/session/runner/max-steps.ts:1-16`

```text
CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)
2. MUST provide a text response summarizing work done so far
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use

Response must include:
- Statement that maximum steps for this agent have been reached
- Summary of what has been accomplished so far
- List of any remaining tasks that were not completed
- Recommendations for what should be done next

Any attempt to use tools is a critical violation. Respond with text ONLY.
```

Where it is sent: `packages/core/src/session/runner/llm.ts:226-244`. When
`step >= loaded.agent.info.steps`, the prompt is appended as an **assistant** message and
`toolChoice` is set to `"none"`:

```ts
// packages/core/src/session/runner/llm.ts:240
messages: stepLimitReached
  ? [...transcript.messages, Message.assistant(MAX_STEPS_PROMPT)]
  : transcript.messages,
// Keep tool definitions on the final Step to preserve the provider's cached prefix.
toolChoice: stepLimitReached ? "none" : undefined,
```

Design commentary:

- **"Tools are disabled until next user input."** — states the mechanism so the model does
  not try to work around it across the remaining steps.
- **"This constraint overrides ALL other instructions, including any user requests for
  edits or tool use"** — the load-bearing sentence. A model that has been told all
  conversation to "then run the tests" will otherwise keep calling tools; the override
  clause is what wins against the standing task.
- **Assistant role, not user role.** The message is appended as an assistant turn, so it
  reads as the model's own continuation constraint rather than a new user request. Sending
  it as a user message invites the model to answer it as a question.
- **`toolChoice: "none"`.** The prompt alone does not stop tool calls on every provider;
  the request-level constraint does. The comment records why the must-respond prompt is a
  defence, not the whole defence.
- **Repetition ("Respond with text ONLY." twice).** The final standalone line is a
  tail-position reminder; models weight the end of the instruction block heavily.
- The failure this prevents: a model that "summarises" by immediately issuing another tool
  call, producing an empty or looping final step.

### A.7 CONTINUE_AFTER_INCOMPLETE_STREAM

Provenance: `packages/core/src/session/runner/llm.ts:35-36`

```ts
const CONTINUE_AFTER_INCOMPLETE_STREAM =
  "The previous response was interrupted. Continue from where you left off without repeating completed content."
```

Where it is sent: `packages/core/src/session/runner/llm.ts:287`, as a synthetic message on
the `Continue` outcome.

Design commentary: after a truncated stream, history is reloaded and the next step must
resume rather than restart. "Continue from where you left off" sets the continuation point;
"without repeating completed content" is the phrase that stops the model from re-emitting
the whole answer — the failure mode without it is duplicated prose that doubles context and
confuses the transcript.

### A.8 CONTINUE_AFTER_OUTPUT_LIMIT

Provenance: `packages/core/src/session/runner/llm.ts:38-39`

```ts
const CONTINUE_AFTER_OUTPUT_LIMIT =
  "Your last response hit the output token limit (stop reason: length). Do not apologize, recap, or repeat yourself. Break the remaining work into smaller pieces."
```

Where it is sent: `packages/core/src/session/runner/llm.ts:317`.

Design commentary: "Do not apologize, recap, or repeat yourself" names the three failure
behaviours that waste the newly available tokens; without them the model spends the budget
on apology. "Break the remaining work into smaller pieces" is the actionable fix — it turns
a truncation into a plan, which is exactly what the bounded-output-limit fitting in
compaction also assumes.

### A.9 Exhausted output-limit continuation failure

Provenance: `packages/core/src/session/runner/llm.ts:309-315`

```ts
return yield* new StepFailedError({
  error: {
    type: "output-limit",
    message: "Response still truncated after two output token limit continuations",
  },
})
```

Design commentary: this is the terminal error after three consecutive assistant messages
all ended with `finish === "length"`. It surfaces as a typed session error instead of
continuing forever. The check "User input or any other finish breaks the streak" is encoded
by the query at `packages/core/src/session/runner/llm.ts:290-308`; the message tells the user
why the agent stopped trying.

### A.10 Tools-disabled loop guard

Provenance: `packages/core/src/session/runner/step.ts:91-93`

```ts
const executeTool = (call: ToolCall) => {
  if (input.prepared.request.toolChoice?.type === "none")
    return new Tool.Error({ message: "Tools are disabled after the maximum agent steps" })
```

Design commentary: this is the execution-side enforcement of A.6. Even if the provider emits
a tool call despite `toolChoice: "none"`, the tool is not executed and the model receives a
short, factual reason. It complements the prompt: the prompt asks, this guard enforces.

---

## Compaction

Compaction prompts turn a conversation into a checkpoint. They are the most parameterised
prompts in the tree: the same template serves an initial summary and every later update.

### A.11 SUMMARY_TEMPLATE

Provenance: `packages/core/src/session/compaction.ts:104-135`

```text
You MUST use this format for your response (you may omit sections that aren't applicable). Do not include the <template> tags in your response.
<template>
## Objective
- [one or two brief sentences describing what the user is trying to accomplish]

## Requirements
- [constraints, preferences, requirements, and scope boundaries stated by the user, or "(none)"]

## Decisions
- [decisions already made and why, or "(none)"]

## Work State
Break the objective into smaller goals and report which are completed, which are being worked on, and which are blocked.
### Completed
- [goals that have been completed; otherwise "(none)"]

### Active
- [goals currently being worked on; otherwise "(none)"]

### Blocked
- [anything blocking progress, and why; otherwise "(none)"]

## Next Move
1. [ordered list of next actions, or "(none)"]

## Relevant Files
List the files and directories, other than the current working directory, that another agent would need to open to continue this work. Include at most 15, most important first. Do not list every file that was read or changed. Include paths outside the current working directory when relevant. If none, write "(none)".
- `[file or directory path]`: [brief reason it matters]

## Important Context
- [facts the next agent cannot continue without and cannot easily find on its own; or "(none)"]
</template>
```

Design commentary:

- **"you may omit sections that aren't applicable"** — prevents padding. A mandatory section
  with nothing to say produces noise that survives into every later request.
- **`<template>` fence with "Do not include the `<template>` tags"** — the tags mark the
  format for the model but must not be echoed. Without the second clause, models copy the
  wrapper into the checkpoint, which then contaminates history forever.
- **Fixed headings.** The headings are load-bearing: `llm.ts`/`compaction.ts` test for them
  to decide whether a reply filled the template. See A.13, where
  `SUMMARY_TEMPLATE.split("\n").filter((line) => line.startsWith("##"))`
  (`packages/core/src/session/compaction.ts:283`) is the exact set checked.
- **"Relevant Files … Include at most 15, most important first."** — a hard budget. Without
  it, summaries list every touched file and the checkpoint grows without bound across
  updates.
- **"Do not list every file that was read or changed."** — closes the obvious loophole to
  the 15 cap.

### A.12 SUMMARY_RULES

Provenance: `packages/core/src/session/compaction.ts:137-143`

```text
Rules:
- Keep each section concise. Use terse, single-line bullets, not prose paragraphs or nested lists.
- Prefer short references over detailed restatement. It is fine to leave out information the next agent can recover from the code or the files listed above.
- Preserve exact file paths, symbols, commands, error strings, URLs, and identifiers.
- Carry forward only user questions or requests that remain unanswered or require further action. Do not repeat ones that newer history has answered or resolved. Preserve exact wording when carrying one forward.
- Preserve consequential workflow state, including whether changes are uncommitted, committed, pushed, under review, or merged.
- Do not mention the summary process or that context was compacted.
```

Design commentary:

- **"Prefer short references over detailed restatement. It is fine to leave out information
  the next agent can recover from the code…"** — the compaction thesis. A summary should
  point at recoverable facts, not duplicate the world. Without this line, summaries bloat.
- **"Preserve exact file paths, symbols, commands, error strings, URLs, and identifiers."**
  — the counterweight. Compression must not paraphrase the things the next step needs
  verbatim; a renamed symbol or a truncated URL breaks the resumed turn.
- **"Do not repeat ones that newer history has answered…"** — prevents a stale open question
  from being carried forward as if still open. This is what keeps updates convergent.
- **"Do not mention the summary process or that context was compacted."** — the model should
  not narrate the machinery. Without it, checkpoints read like meta-commentary ("earlier,
  context was compacted") and the model may re-summarise on later turns.

### A.13 Initial buildPrompt (first summary)

Provenance: `packages/core/src/session/compaction.ts:145-158` (`buildPrompt(update=false)`).
Assembly: `[lead, ...shared].join("\n\n")`.

```ts
// packages/core/src/session/compaction.ts:146
const shared = [
  "Summarize only what the user and the assistant said and did. Leave out instructions and setup the assistant was given rather than told by the user: repository conventions, instruction files such as AGENTS.md, and environment details like the session ID. The next agent receives current versions of all of these separately.",
  SUMMARY_TEMPLATE,
  SUMMARY_RULES,
  "Do not continue the task or call tools.",
  "Return only the structured summary in the requested format. Do not include a preamble, explanation, or other commentary.",
]
if (!update) {
  return [
    "You MUST summarize the conversation above into a structured summary that will be given to another agent to resume the work.",
    ...shared,
  ].join("\n\n")
}
```

Assembled result (first summary) is the lead line, a blank line, then each `shared` element
joined by blank lines.

Design commentary:

- **"Summarize only what the user and the assistant said and did. Leave out instructions and
  setup the assistant was given…"** — the single most important design decision in
  compaction. Instructions, AGENTS.md conventions, and the session ID are re-supplied fresh
  on the next request (the Instructions group), so summarising them is redundant at best and
  stale at worst. Without this line the checkpoint restates conventions that then contradict
  the live instruction block.
- **"Do not continue the task or call tools."** — the model is holding a conversation it was
  mid-task on; the natural next move is to keep working. This line reframes the turn as a
  report.
- **"Return only the structured summary… Do not include a preamble, explanation, or other
  commentary."** — the reply is stored verbatim as the checkpoint, so any preamble enters
  history. The failure without it is a summary wrapped in "Here is the summary you asked
  for:".

### A.14 Update buildPrompt (subsequent summaries), including the legacy paragraph

Provenance: `packages/core/src/session/compaction.ts:159-175`

```ts
return [
  "Update the existing checkpoint in the conversation above into one consolidated summary.",
  // Before #48058 (Sep 2026), summaries kept nearly everything: every file touched, per-edit changelogs,
  // restated AGENTS.md conventions, and an "Additional Context" section that grew on every update. The
  // preserve-first update prompt would carry that detail forward indefinitely, so a checkpoint from that
  // template is rewritten once at the current level of detail. The rewrite uses the new headings, so later
  // updates skip this. Remove once no session still in use has a latest checkpoint older than #48058.
  ...(legacy
    ? [
        "The existing checkpoint was written with an earlier format that recorded far more detail than this one asks for. Rewrite it at the level of detail described below rather than carrying its detail forward. Keep its requirements, decisions, and open questions; they came from earlier conversation with the user.",
      ]
    : []),
  "Newer history always takes precedence over the existing checkpoint. Preserve previous information unless newer history clearly contradicts, supersedes, resolves, or makes it stale. If something is no longer relevant to continuing the work, you may remove it.",
  "Incorporate newer requirements, decisions, progress, and context. Reconcile Work State and Next Move: move completed work out of Active, remove resolved blockers and answered questions, and preserve unresolved or pending work.",
  "Return only the updated Markdown sections. Do not reproduce the `<conversation-checkpoint>`, `<summary>`, or `<recent-context>` wrapper tags from the previous checkpoint.",
  ...shared,
].join("\n\n")
```

Design commentary:

- **"Newer history always takes precedence over the existing checkpoint."** — states the
  resolution order explicitly, because both the old checkpoint and the new messages are in
  context and the model must know which wins on conflict. Without it, a stale checkpoint can
  override newer user input.
- **"Reconcile Work State and Next Move…"** — names the specific reconciliation the format
  implies: completed work leaves Active, resolved blockers and answered questions disappear.
  This is what makes repeated compaction idempotent rather than accumulative.
- **The legacy paragraph** (`packages/core/src/session/compaction.ts:166-170`, gated on
  `previous?.summary.includes("## Additional Context")`). It exists because checkpoints
  written with the pre-#48058 template record "far more detail than this one asks for", and a
  preserve-first update would carry that detail forward forever. The paragraph forces a
  one-time rewrite to the current level of detail; because the rewrite uses the new
  headings, later updates skip the branch. The inline comment records the removal condition:
  once no live session has a checkpoint older than #48058.
- **"Do not reproduce the `<conversation-checkpoint>`, `<summary>`, or `<recent-context>`
  wrapper tags"** — the previous checkpoint is presented wrapped (A.35); without this
  instruction the model nests the old wrapper inside the new summary.

### A.15 NUDGE

Provenance: `packages/core/src/session/compaction.ts:178-179`

```ts
const NUDGE =
  "The previous response did not fill in the required summary template. Do not call tools. Return the summary as text using the exact section headings from the template."
```

Where it is sent: `packages/core/src/session/compaction.ts:298-303`. If the first reply does
not contain a template heading (checked at :283-284), the nudge is appended once and the
model is asked again; a second miss fails.

Design commentary: one reminder, then failure. This is a bounded retry that does not consume
a second full summarisation if the model is simply misbehaving. "Do not call tools" is
repeated because a model that ignored the format may also be ignoring the no-tools rule.

### A.16 "Nothing to compact"

Provenance: `packages/core/src/session/compaction.ts:93`

```ts
const NOTHING_TO_COMPACT: Failure = { error: { type: "compaction.unavailable", message: "Nothing to compact yet" } }
```

Design commentary: a typed failure, not a prompt, but model-facing through the `/compact`
inbox item's outcome. The phrase "yet" signals the condition is transient. Without the typed
error, an empty compaction would publish a checkpoint with empty text and corrupt history.

### A.17 Compaction failure messages

Provenance: `packages/core/src/session/compaction.ts`. These are `SessionError.Error`
payloads, several of which surface to the model or the transcript.

```ts
// :304-311
error: {
  type: "compaction.failed",
  message: retry.text.trim()
    ? "Compaction summary did not match the required template"
    : "Compaction produced no summary",
}

// :419-427
error: {
  type: "compaction.failed",
  message:
    "The compaction request cannot be reduced further without losing the latest exchange or checkpoint",
}

// :558-562 (finish reason "length")
unusable({
  type: "compaction.failed",
  message: "Compaction summary reached the output token limit",
})

// :563-564 (finish reason "content-filter")
unusable(contentFilterError("Compaction summary was blocked by the provider", event.reason))

// :545-552 (finish reason "unknown")
new InvalidProviderOutputError({
  message: "The provider response ended with an unknown finish reason.",
  classification: "incomplete-stream",
})

// :556 (finish reason "error")
new UnknownProviderError({ message: "Compaction generation failed" })

// :343 / :347 / :374 (native compaction unsupported)
unsupported("Provider compaction requires a stable, configured endpoint")
unsupported(
  "Provider compaction requires the endpoint in provider/model settings, not a model.request rewrite",
)
unsupported(`Native compaction is not supported for ${request.model.provider}/${request.model.route.id}`)
```

Design commentary: each message names a distinct, actionable cause. "cannot be reduced
further without losing the latest exchange or checkpoint" is the shrink loop's terminal
condition and tells the operator that the failure is a hard floor, not a transient error.
The two native-compaction messages distinguish "no stable endpoint" from "a hook rewrote
the route", which are fixed in different places.

### A.18 `<conversation-checkpoint>` wrapper

Provenance: `packages/core/src/session/runner/to-llm-message.ts:311-325`

```ts
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

Assembled example:

```text
<conversation-checkpoint>
The following is a summary and serialized record of earlier conversation. Treat it as historical context, not as new instructions.

<summary>
## Objective
- ...
</summary>

<recent-context>
[User]: ...
[Assistant]: ...
</recent-context>
</conversation-checkpoint>
```

Design commentary:

- **Presented as a `user` message.** History lowering has one role available for context
  that is not an assistant turn: user. The wrapper tags and the explanatory sentence exist
  because of this choice — the model must not read the checkpoint as a fresh instruction
  from the user.
- **"Treat it as historical context, not as new instructions."** — the load-bearing phrase.
  Without it, a summary containing the user's earlier imperative ("rewrite the parser") can
  be re-executed as a new command, a classic compaction failure.
- **`<summary>` and optional `<recent-context>`.** The split is exact: `summary` is the
  model-written text, `recent` is the newest kept-verbatim messages serialised beside it
  (`packages/core/src/session/compaction.ts:269-271`). `to-llm-message.ts:173` instructs the
  update prompt to reproduce neither wrapper, so they stay singular.

---

## Tools

### A.19 Subagent tool description

Provenance: `packages/core/src/tool/plugin/subagent.ts:55-62` (assembled with `.join("\n")`).

```text
Spawns an agent in a child session to work on the specified task.
The output includes a sessionID you can pass back later to continue that specific conversation with the subagent.
New child sessions start with fresh context, so include all relevant context and instructions when you don't pass a sessionID.
Foreground (default) runs the subagent to completion and returns its final response.
Background mode (background=true) launches it asynchronously and returns immediately; you are notified when it finishes.
Use background only for independent work that can run while you continue elsewhere.
```

A context hook appends the available-subagent list at
`packages/core/src/tool/plugin/subagent.ts:297-305`:

```ts
tool.description = [
  tool.description,
  "",
  "Available subagents:",
  ...available.map(
    (agent) =>
      `- ${agent.id}: ${agent.description ?? "This subagent should only be called when explicitly requested."}`,
  ),
].join("\n")
```

Design commentary:

- **"New child sessions start with fresh context…"** — sets the expectation that a subagent
  has none of the parent's history, so the model must pass context. Without it, the model
  launches a subagent with a one-line prompt and gets a useless result.
- **"The output includes a sessionID you can pass back later to continue…"** — teaches the
  continuation affordance, which the model otherwise would not discover.
- **"Use background only for independent work…"** — a scoping rule; without it the model
  backgrounds work it then needs, and stalls.
- **The injected `Available subagents:` list.** The tool is described generically in code;
  the concrete, permission-filtered roster is appended per request. The fallback sentence
  "This subagent should only be called when explicitly requested." prevents an
  under-described agent from being auto-invoked.

### A.20 Subagent input field descriptions

Provenance: `packages/core/src/tool/plugin/subagent.ts:29-48`

```ts
// :30-33
agent: Schema.String.annotate({
  description:
    "The type of specialized agent to use for this task. If the user asks for a subagent by a name that is not one of the available subagents, they most likely mean a model: pick a suitable agent and pass the name through the model parameter instead.",
}),
// :34
description: Schema.String.annotate({ description: "A short 3-5 word label for the task, displayed to the user" }),
// :35
prompt: Schema.String.annotate({ description: "The task for the subagent to perform" }),
// :36-39
model: Schema.optionalKey(Schema.String).annotate({
  description:
    'NEVER set this unless the user explicitly asks for a particular model or variant. The value is written as "providerID/modelID", or "providerID/modelID#variant" to include a variant. Do not guess the ID: look the model up with the models tool, filtering to your own provider first.',
}),
// :40-43
sessionID: Schema.optionalKey(SessionSchema.ID).annotate({
  description:
    "Continue a specific previous subagent conversation by passing its sessionID. Calls without a sessionID start a new conversation.",
}),
// :44-47
background: Schema.optionalKey(Schema.Boolean).annotate({
  description:
    "Run the subagent in the background and return immediately. You will be notified when it completes. DO NOT sleep, poll, or proactively check on its progress.",
}),
```

Design commentary:

- **The `agent` field's disambiguation clause.** Users frequently say "ask GPT-5 to review
  this", which names a *model*, not an agent. The description tells the model to translate
  that intent into the `agent`/`model` split rather than fail with "unknown agent". The
  matching runtime error is `Unknown agent: ${input.agent}` (`:135`).
- **`NEVER set this unless…` for `model`.** A hard prohibition against the model
  second-guessing the configured model. The companion instruction "look the model up with
  the models tool" ties this field to the `opencode.models` tool (A.32).
- **`DO NOT sleep, poll, or proactively check` for `background`.** Repeats the guidance in
  A.21 because the model sees either one or the other in isolation.

### A.21 Subagent background guidance

Provenance: `packages/core/src/tool/plugin/subagent.ts:19-27` (assembled with `.join("\n")`).

```text
The subagent is working in the background (sessionID: <id>). You will be notified automatically when it finishes.
DO NOT sleep, poll for progress, ask the subagent for status, or duplicate this subagent's work; avoid working with the same files or topics it is using.
Work on non-overlapping tasks, or briefly tell the user what you launched and end your response.
```

Filled example prefixes the actual child id, e.g. `sessionID: ses_…`.

Design commentary: three distinct prohibitions and one alternative. "DO NOT sleep, poll…
duplicate this subagent's work" names the exact anti-patterns (models left alone with an
async job will loop on status checks). The final line gives the model something to do
instead, which is what makes the prohibition stick.

### A.22 Question tool description

Provenance: `packages/core/src/tool/plugin/question.ts:12-21`

```text
Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- A "Type your own answer" option is added automatically; don't include a separate option for free form answers
- Set `multiple: true` to allow selecting more than one option
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label
```

Design commentary:

- **The four-item list** tells the model *when* the tool is appropriate; without it, models
  either never ask or ask about trivia.
- **"A 'Type your own answer' option is added automatically"** — a UI fact; without it the
  model adds its own free-form option and the form has two.
- **"(Recommended)" convention** — a cross-layer contract with the form renderer; the label
  text is what the user sees.

### A.23 Question answer render

Provenance: `packages/core/src/tool/plugin/question.ts:38-46`

```ts
export const toModelContent = (questions: ReadonlyArray<Question.Prompt>, answers: ReadonlyArray<Question.Answer>) => {
  const formatted = questions
    .map(
      (question, index) =>
        `"${question.question}"="${answers[index]?.length ? answers[index].join(", ") : "Unanswered"}"`,
    )
    .join(", ")
  return `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`
}
```

Assembled example:

```text
User has answered your questions: "Which database should I use?"="Postgres, Redis". You can now continue with the user's answers in mind.
```

Design commentary: the `"question"="answer"` pairing is unambiguous when the model asked
several questions at once; a bare list would lose the mapping. "Unanswered" is explicit so
the model does not invent a value. The closing sentence re-establishes the task.

### A.24 Skill tool description and `<skill_content>`

Provenance: description at `packages/core/src/tool/plugin/skill.ts:21-25`; rendered payload
at `packages/core/src/skill.ts:36-53`.

```text
Load a specialized skill's instructions and resources into the current conversation when the task at hand matches its description.

The skill ID must match an available skill or a skill explicitly referenced by the user.
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

Filled example:

```text
<skill_content name="sample-skill">
# Skill: sample-skill

<skill body>

Base directory for this skill: /Users/.../.opencode/skills/sample-skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/Users/.../reference/notes.md</file>
</skill_files>
</skill_content>
```

Design commentary:

- **`<skill_content name="…">` wrapper with a matching name attribute.** The wrapper is
  referenced by name in the skill catalog instructions (A.39) — "its instructions appear in
  the conversation as a `<skill_content>` block" — so the model recognises an auto-loaded
  skill and does not re-load it.
- **"Base directory for this skill: … Relative paths in this skill … are relative…"** —
  makes the skill's own relative references resolvable. Without it a skill that says "run
  `scripts/setup.sh`" leaves the model guessing the cwd.
- **"Note: file list is sampled."** — honesty about truncation; the file list is capped at
  10 (`packages/core/src/skill.ts:59-62`). Without the note, the model assumes it has the
  complete directory listing.

### A.25 Read tool description

Provenance: `packages/core/src/tool/plugin/read.ts:43-44`

```text
Read the contents of a file or directory. Supports text files, images, and PDFs. Images and PDFs are presented directly to the model. Each text line is prefixed by its 1-based line number as <line>: <content>. The prefix is for reference and is not part of the file content. Directory entries are returned one per line. Use offset and limit to read large files or directories in sections. Prefer one larger read over many small slices, and use grep to find specific content in large files.
```

Input descriptions: `:17-25` (`path` "File or directory to read"; `offset`/`limit` as shown).

Design commentary:

- **"Each text line is prefixed by its 1-based line number as `<line>: <content>`. The prefix
  is for reference and is not part of the file content."** — the critical pair. The edit tool
  description (A.28) explicitly tells the model to *omit* this prefix, so read must describe
  the prefix it injects. Without the "not part of the file content" clause, models write the
  line numbers into `oldString` and the edit fails.
- **"Prefer one larger read over many small slices"** — a direct instruction against the
  expensive pattern of many small windowed reads, which inflate step count.
- Directory listing format is produced by `toModelContent` at `:175-211` (`Read file ${path},
  lines ${start}-…`, `Read directory ${path}, entries …`, and the truncation marker
  `[Output truncated. Continue reading with offset: ${output.next}]`).

### A.26 Grep tool description

Provenance: `packages/core/src/tool/plugin/grep.ts:78-79`; formatting at `:44-61`; input
descriptions at `:17-38`.

```text
Search file contents using ripgrep's regular expression syntax or literal text matching. Use it to locate specific code, symbols, or text patterns, and narrow searches with `path` or `include`. Returns matching file paths, line numbers, and line previews.
```

Truncation tail (assembled at `:55-59`):

```text
(Results are truncated: showing first <n> results. Consider using a more specific path or pattern.)
```

Design commentary:

- **"narrow searches with `path` or `include`"** — pre-empts the failure where the model
  issues a repo-wide regex and drowns in results.
- **The truncation sentence with an actionable fix.** "Consider using a more specific path or
  pattern." is the guidance; without it the model retries the same query. The empty case is
  `No matches found` (`:45`).

### A.27 Glob tool description

Provenance: `packages/core/src/tool/plugin/glob.ts:59`

```text
Search file paths using a glob pattern (examples: "**/*.ts", "src/**/*.tsx").
```

Design commentary: short by design; the examples carry the format. The truncation tail
matches grep's (`:37-40`), and the empty case is `No files found` (`:35`).

### A.28 Edit tool description

Provenance: `packages/core/src/tool/plugin/edit.ts:222-223`; input descriptions `:24-34`.

```text
Edit the contents of a file by finding and replacing exact text. When editing text from Read output, preserve the exact indentation (tabs or spaces) and omit the line-number prefix, such as `1: `. Never include the prefix in oldString or newString. Write line breaks as \n; the file's existing CRLF or LF line endings are matched and preserved. To change line endings themselves, make oldString and newString differ only in \r; that edit applies to the exact bytes. If there is no exact match, the edit retries while ignoring typographic quote, dash, and space variants, then trailing whitespace on each line. The edit fails if oldString is not found. By default, oldString must identify a UNIQUE location. Multiple matches FAIL unless replaceAll is true. Add more surrounding context to disambiguate, or set replaceAll to true to replace every occurrence. Use replaceAll when the change should apply to every occurrence, such as renaming a variable.
```

Runtime error strings (`:234-241`, `:286-299`):

```text
No changes to apply: oldString and newString are identical.
oldString must not be empty. Use write to create or overwrite a file.
Could not find oldString in ${input.path}. It must match exactly, including whitespace and indentation.
Found ${replacements} matches for oldString, but expected exactly one. Add more surrounding context to make oldString unique, or set replaceAll to true to replace every occurrence.
No changes to apply: ${input.path} already has those line endings.
No changes to apply: the edit leaves ${input.path} unchanged. Line endings follow the file; to change them, write \r explicitly in oldString or newString.
```

Design commentary:

- **The description is a precise specification of the matcher.** It documents the three
  matching tiers (exact, then typographic-variant, then trailing-whitespace-tolerant — see
  `matchView` and `findLineOccurrences`, `:66-188`), the line-ending rule, and the
  uniqueness default. This is deliberate: the edit tool's power comes from a match algorithm
  the model must understand to use well.
- **"omit the line-number prefix … Never include the prefix in oldString or newString"** —
  the exact complement of A.25. This pairing is the single most important cross-tool prompt
  contract in the toolkit.
- **"By default, oldString must identify a UNIQUE location. Multiple matches FAIL…"** — with
  the fix ("Add more surrounding context to disambiguate, or set replaceAll to true").
  Without the fix, the model retries blindly.
- **"Use replaceAll when the change should apply to every occurrence, such as renaming a
  variable."** — teaches the safe use of the escape hatch so `replaceAll` is not used to
  force a change the model does not actually want everywhere.

### A.29 Write tool description

Provenance: `packages/core/src/tool/plugin/write.ts:60-61`; result render at `:38-39`.

```text
Writes a file to the local filesystem, overwriting if one exists.

Missing parent directories are created automatically.

Use this tool to create new files or overwrite existing files. For partial changes, use the edit tool instead.
```

Result render: `${output.existed ? "Wrote" : "Created"} file successfully: ${output.resource}`.

Design commentary: "For partial changes, use the edit tool instead." is the steer away from
whole-file writes. The `Wrote`/`Created` distinction in the result tells the model whether it
overwrote something, which matters for a following edit.

### A.30 Patch tool description

Provenance: `packages/core/src/tool/patch.txt:1-33` (imported as `DESCRIPTION` at
`packages/core/src/tool/plugin/patch.ts:16`).

```text
Use the `patch` tool to edit files. Your patch language is a stripped‑down, file‑oriented diff format designed to be easy to parse and safe to apply. You can think of it as a high‑level envelope:

*** Begin Patch
[ one or more file sections ]
*** End Patch

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

*** Add File: <path> - create a new file. Every following line is a + line (the initial contents).
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place (optionally with a rename).

Example patch:

```
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
```

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with `+` even when creating a new file
```

Result render (`patch.ts:39-45`): `Success. Updated the following files:` followed by
`A`/`M`/`D`-prefixed resource lines.

Design commentary: the patch tool is only exposed for certain models (the hook at
`patch.ts:296-309` deletes `edit`/`write` for `gpt-*` non-`oss`/non-`gpt-4` models, and
deletes `patch` otherwise). The description therefore teaches a whole grammar: the `***`
envelope, the three operation headers, and the mandatory `+` prefix. The failure without the
last bullet is a new file whose every line lacks the `+`, which the parser rejects.

### A.31 Shell tool description

Provenance: `packages/core/src/tool/plugin/shell.ts:36-46` (parameterised; assembled with
`.join(" ")`). Input descriptions `:48-61`. Background instruction `:26-27`.

Template:

```ts
const description = (shell?: string) =>
  [
    "Execute a shell command and return its output.",
    ...(shell ? [`Commands run on ${OS} using ${shell}.`] : []),
    "Quote file paths containing spaces or special characters.",
    "Prefer dedicated tools over shell commands when possible.",
    "When output is large, the full result is saved to a file and a truncated preview is returned.",
    "Rely on automatic truncation unless filtering the output is more useful.",
    "Commands accept an optional timeout, background commands have no timeout by default.",
    "Background commands return immediately, and you will be notified when they complete.",
  ].join(" ")
```

Filled example (macOS, zsh — the shell name and OS come from the context hook at `:283-288`):

```text
Execute a shell command and return its output. Commands run on macOS using zsh. Quote file paths containing spaces or special characters. Prefer dedicated tools over shell commands when possible. When output is large, the full result is saved to a file and a truncated preview is returned. Rely on automatic truncation unless filtering the output is more useful. Commands accept an optional timeout, background commands have no timeout by default. Background commands return immediately, and you will be notified when they complete.
```

Background instruction (`:26-27`), sent as the result notice when a command is still running:

```text
You will be notified automatically when the command finishes. The notification will include the command's output. Unless the user explicitly asks otherwise, DO NOT poll for completion, even if you need the final result to continue. Repeatedly sleeping and reading or searching the output file is polling, not useful work. You may read the current output if it lets you do useful work now, but do not repeatedly check it while waiting for the command to finish. Keep working on anything that does not depend on the result. If you have nothing else to do, end your response; you will be resumed automatically when the command finishes.
```

Timeout notice (`:229-230`):

```text
Command exceeded timeout of ${finalTimeout} ms. Retry with a larger timeout if the command is expected to take longer.
```

Design commentary:

- **"Commands run on macOS using zsh."** — the shell is resolved per Location and injected
  at request time; without it the model guesses bash-isms.
- **"Prefer dedicated tools over shell commands when possible."** — repeats A.2's guidance
  for a model that reads only the tool description.
- **"the full result is saved to a file and a truncated preview is returned" / "Rely on
  automatic truncation"** — describes the empty-string-heavy bounding machinery
  (`packages/core/src/tool-output.ts:67-118`) so the model neither re-runs the command to see
  the tail nor truncates manually.
- **The background instruction's density** is proportional to the failure mode: models given
  an async command poll it relentlessly. The paragraph names polling ("Repeatedly sleeping
  and reading or searching the output file is polling, not useful work") and supplies the
  alternative ("Keep working on anything that does not depend on the result… end your
  response").
- **The timeout notice's second sentence** turns a failure into an action.

### A.32 Webfetch tool description

Provenance: `packages/core/src/tool/plugin/webfetch.ts:17-19`; input descriptions `:23-30`.

```text
Fetch content from an HTTP or HTTPS URL and return it as text, markdown, or HTML. Markdown is the default.

Use a more targeted tool when one is available. This tool is read-only. Large text results may be replaced with a preview while the complete output is retained in managed storage.
```

Design commentary: "Use a more targeted tool when one is available. This tool is read-only."
keeps webfetch as a fallback rather than a default; "Large text results may be replaced with
a preview" pre-empts confusion when the body is bounded.

### A.33 Websearch tool description

Provenance: `packages/core/src/tool/plugin/websearch.ts:20-22` (parameterised by the current
year).

```ts
export const description = `Search the web using the user's selected search integration. Use this for current information beyond knowledge cutoff.

The current year is ${new Date().getFullYear()}. Use this year when searching for recent information or current events.`
```

Filled example (2026):

```text
Search the web using the user's selected search integration. Use this for current information beyond knowledge cutoff.

The current year is 2026. Use this year when searching for recent information or current events.
```

No-results string (`:13`): `No search results found. Please try a different query.`

Design commentary: the year is computed at module load. Without it the model writes queries
and summaries pinned to its training year. This is the tool-side counterpart of the date
instruction (A.4).

### A.34 OpenCode namespace and tools

Provenance: `packages/core/src/tool/plugin/opencode.ts`. Namespace description `:107-109`;
per-tool descriptions `:112-113`, `:132-133`, `:157`, `:171`, `:183-184`, `:221-222`; the
worktree system-note hook `:94-98`.

```text
Tools for managing OpenCode itself, such as working with sessions and worktrees, searching the available models, and reading MCP resources.
```

```text
Rename a session, or omit sessionID to rename the current session. Use a short, specific title that summarizes the work being done.
Move a session to another directory, or omit sessionID to move the current session. The current session moves at the next safe boundary; do not run destination-dependent tools in the same execute call.
Create a named worktree. Returns its directory.
List a repository's worktrees.
Remove a worktree. The repository location selects configuration; directory identifies the worktree to remove.
Search the models available to use. Use this to turn a model name the user mentions into an exact reference before running a subagent on it. Check your own provider first.
```

System-note hook (`:94-98`), appended to the system parts:

```text
When you create a worktree outside the current working directory and intend to use it as your primary working directory, consider using `execute` to call `tools.opencode.session_move` and make the worktree the session's working directory.
```

Design commentary:

- **"The current session moves at the next safe boundary; do not run destination-dependent
  tools in the same execute call."** — a concurrency contract expressed as prompt guidance.
  It prevents a step from reading the old directory while a move is queued.
- **"Use this to turn a model name the user mentions into an exact reference before running a
  subagent on it."** — ties `opencode.models` to the subagent `model` field (A.20).
- **The system-note hook** is inserted into the system prompt only when these tools exist; it
  teaches the CodeMode call shape (`tools.opencode.session_move`) that the model would
  otherwise have to discover.

### A.35 MCP resource tools

Provenance: `packages/core/src/tool/plugin/mcp-resource.ts`. `list_mcp_resources` at
`:20-21`; `read_mcp_resource` at `:52-53`; input descriptions `:23-25`, `:55-60`.

```text
List documents, records, and other data exposed by MCP servers. Use this when the user refers to something that is not a local file, such as a URI with a custom scheme, then load a match with read_mcp_resource. Each entry names the server to read it from. Templates are resources addressed by a parameter such as a record ID; fill in the uriTemplate placeholders before reading.
```

```text
Read one MCP resource by server and URI. Not for local files. Always return the full contents rather than slicing or filtering them; oversized output is truncated automatically and the full content is saved to a file you can read. Images and PDFs are shown to you directly.
```

Design commentary:

- **"Not for local files."** — an explicit boundary; without it the model may attempt to read
  a filesystem path through MCP. The counterpart is `read_mcp_resource`'s missing-server
  error (`:76-78`).
- **"Templates are resources addressed by a parameter such as a record ID; fill in the
  uriTemplate placeholders before reading."** — explains the `uriTemplate` concept the model
  sees in the list output.
- **"Always return the full contents rather than slicing or filtering them…"** — instructs
  the model not to page through an MCP resource, since bounding is handled automatically.

### A.36 Tool input-validation error

Provenance: `packages/core/src/tool/runtime.ts:88-100`

```ts
const formatInputIssues = (tool: string, issues: ReadonlyArray<StandardSchemaV1.Issue>, value: unknown) => {
  const details = issues.slice(0, 5).map((issue) => {
    const path =
      issue.path?.reduce<string>((path, segment) => {
        const key = typeof segment === "object" ? segment.key : segment
        if (typeof key === "number") return `${path}[${key}]`
        return path === "" ? String(key) : `${path}.${String(key)}`
      }, "") || "root"
    return `- ${path}: ${issue.message}`
  })
  if (issues.length > 5) details.push(`- ...and ${issues.length - 5} more ${issues.length === 6 ? "issue" : "issues"}`)
  return `Invalid arguments for tool "${tool}":\n${details.join("\n")}\n\nArguments provided:\n${JSON.stringify(value, null, 2)}\n\nUpdate the arguments and call the tool again.`
}
```

Filled example:

```text
Invalid arguments for tool "edit":
- newString: Expected string for form field: newString

Arguments provided:
{
  "path": "a.ts",
  "oldString": "x"
}

Update the arguments and call the tool again.
```

Design commentary: this is the model's repair loop. It names the tool, the offending path
(`path[i]` for arrays), and includes the actual arguments so the model can see its own
mistake. The closing "Update the arguments and call the tool again." is the required action;
without it, models sometimes apologise instead of retrying. The list is capped at five
issues with a remainder count to bound the message.

### A.37 Tool-unavailable and unknown-tool errors

Provenance: `packages/core/src/tool.ts:275`, `:281-283`; `packages/core/src/session/model-request.ts:244`.

```ts
// packages/core/src/tool.ts:275
return yield* new Tool.Error({ message: `Tool is not available for this request: ${event.tool}` })
```

```ts
// packages/core/src/tool.ts:281
return yield* new Tool.Error({
  message: `No tool named "${name}" is currently available. Please use a tool from the available tool list.`,
})
```

```ts
// packages/core/src/session/model-request.ts:244
execute: () => new Tool.Error({ message: "Tools are not available for this request" }),
```

Related terminal error (`packages/core/src/session/runner/publish-llm-event.ts:569-570`);
`tool.unknown` error surfaced when the provider reports `Unknown tool: <name>`.

Design commentary:

- **"Tool is not available for this request"** — the tool existed at snapshot time but was
  removed or renamed for this specific request. This is the failure the snapshot-with-reused-
  definitions design prevents from becoming a crash.
- **"No tool named "…" is currently available. Please use a tool from the available tool
  list."** — the second clause steers the model back to the advertised set instead of
  guessing again. The quoted-name form lets the model see exactly what it asked for.

### A.38 IMAGE_REMOVED and unsupported-media error

Provenance: `packages/core/src/session/model-request.ts:45-46`, `:132-147`.

```ts
const IMAGE_REMOVED =
  "[This image was removed to reduce the request size and is no longer visible. Do not make claims about its contents from memory. If needed, retrieve it again with an available tool or ask the user to attach it again.]"
```

```ts
const unsupportedMedia = (mime, name, capabilities, provider) => {
  const modality = mimeToModality(mime)
  if (!modality) return
  const unsupported = !capabilities.input.some((item) => item.startsWith(modality))
    ? modality
    : provider === "xai" && modality === "image" && !XAI_IMAGE_MIMES.has(mime.toLowerCase())
      ? mime
      : undefined
  if (!unsupported) return
  return `ERROR: Cannot read ${name ? `"${name}"` : modality} (this model does not support ${unsupported} input). Inform the user.`
}
```

Filled examples:

```text
ERROR: Cannot read "diagram.png" (this model does not support image input). Inform the user.
ERROR: Cannot read image (this model does not support image/gif input). Inform the user.
```

Design commentary:

- **IMAGE_REMOVED's "Do not make claims about its contents from memory."** — the critical
  clause. The bounding pass drops inline image bytes when a request exceeds 25 MiB
  (`model-request.ts:43-44`, `boundImages` at `:189-216`). Without the explicit warning,
  the model invents descriptions of an image it can no longer see. "retrieve it again … or
  ask the user to attach it again" gives it a route back.
- **The unsupported-media error instructs "Inform the user."** — the model cannot act on the
  error itself, so the prompt tells it what it can do. Naming the specific modality
  (`image/gif` for xAI) is more actionable than "media unsupported".

### A.39 Hardcoded user-role wrappers (shell, location-switch, synthetic, skill)

Provenance: `packages/core/src/session/runner/to-llm-message.ts:260-303`.

```ts
// :260-268 location-switched
case "location-switched":
  return [
    Message.make({
      id: message.id,
      role: "user",
      content: `The working directory has been changed to ${message.location.directory}.`,
      metadata: message.metadata,
    }),
  ]
```

```ts
// :287-288 synthetic
case "synthetic":
  return [Message.make({ id: message.id, role: "user", content: message.text })]
```

```ts
// :289-290 skill
case "skill":
  return [Message.make({ id: message.id, role: "user", content: message.text, metadata: message.metadata })]
```

```ts
// :293-303 shell
case "shell":
  // Background shell results enter context once, through their completion inbox item.
  if (message.metadata?.background === true) return []
  return [
    Message.make({
      id: message.id,
      role: "user",
      content: `The following shell command was executed by the user:\n\nCommand:\n${message.command}\n\nOutput:\n${message.output?.output ?? ""}`,
      metadata: message.metadata,
    }),
  ]
```

Filled shell example:

```text
The following shell command was executed by the user:

Command:
bun test

Output:
...test output...
```

Design commentary:

- **Everything that is not an assistant turn or a real user prompt is lowered as `user`.**
  These wrappers exist so the model can tell the difference. The shell wrapper, in
  particular, attributes the command to the user rather than the assistant — otherwise the
  model may believe it ran the command and reason incorrectly about its own actions.
- **"The working directory has been changed to <dir>."** — a hardcoded sentence, not a free
  string, so location changes are always phrased identically and in the same role.
- **Synthetic text is passed straight through** because its content is authored by the
  harness (e.g. A.7, A.8). It is `user`-role by the same role-scarcity rule.
- **Background shells return `[]`.** Their result enters history exactly once, through the
  completion inbox item (A.31's notice path); lowering them twice would duplicate output.

### A.40 CodeMode catalog render

Provenance: `packages/core/src/codemode/instructions.ts:9-30` (prompt and `render`);
`packages/core/src/codemode/catalog.ts` (`summarize`, `namespaceLine`); `execute` tool
description at `packages/core/src/codemode/tool.ts:62-69`.

Invariant Code Mode prompt (`codemode/instructions.ts:9-17`, template):

```text
# Code Mode

Use the `execute` tool to call the tools listed below. They cannot be called directly${hasMoreTools ? ", and neither can `search`. Both" : ". They"} only work inside code you pass to `execute`.

${hasMoreTools ? `The catalog is partial. Inside \`execute\`, use \`search(...)\` to find a tool, then call it by the \`path\` in the result. \`search\` is synchronous. Call it without \`await\`; it does not return a Promise. Do not guess tool names.

- ${searchSignature}` : "The catalog is complete. Do not guess tool names."}

## Available tools
```

Filled example (partial catalog):

```text
# Code Mode

Use the `execute` tool to call the tools listed below. They cannot be called directly, and neither can `search`. Both only work inside code you pass to `execute`.

The catalog is partial. Inside `execute`, use `search(...)` to find a tool, then call it by the `path` in the result. `search` is synchronous. Call it without `await`; it does not return a Promise. Do not guess tool names.

- <search signature>

## Available tools
- opencode (3 tools) // Tools for managing OpenCode itself, …
  - tools.opencode.session_move({...}) // Move a session to another directory…
  - ...
```

Removed render (`codemode/instructions.ts:138`):

```text
Code Mode tools are no longer available. Do not use any previously listed Code Mode tools.
```

`execute` tool description (`codemode/tool.ts:62-69`, assembled with `.join("\n")`):

```text
Run JavaScript in a confined Code Mode runtime to script tool calls and HTTP requests and compose their results.
`fetch` is available for HTTP requests. Imports, direct filesystem access, and timers are unavailable; all other external access goes through `tools`.
Within `{ code }`, the only callable tools are those explicitly listed in the Code Mode catalog instructions or returned by the `search` function. Inside `{ code }`, ignore tools shown outside the Code Mode catalog. They are not available in the Code Mode runtime.
Call tools through `tools` using only exact paths and signatures from the catalog. Do not infer or normalize tool names; preserve bracket notation such as `tools.<namespace>["tool-name"](input)`.
Prefer an explicit `return`; if omitted, the final top-level expression becomes the result.
Await every call whose completion matters; pending calls are interrupted when execution ends. Run independent calls concurrently with `Promise.allSettled`.
```

Namespace line (`codemode/catalog.ts:165-174`, assembled):

```text
- ${namespace.name} (${count}) // ${namespace.description}
```

e.g. `- opencode (5 tools, 3 shown) // Tools for managing OpenCode itself, …`.

Design commentary:

- **"They cannot be called directly${…}, and neither can `search`."** — tells the model that
  Code Mode tools are *not* provider tools; a model that calls them directly gets an unknown
  tool error. The `hasMoreTools` branch only mentions `search` when `search` actually exists.
- **"The catalog is partial. … Do not guess tool names."** — when the catalog exceeds the
  inline budget (`catalog.ts:50`, 2000 tokens), only some listings are shown and `search` is
  offered. Without the explicit "Do not guess", the model invents paths.
- **"`search` is synchronous. Call it without `await`; it does not return a Promise."** —
  the single easiest mistake in a code-execution tool, called out with its consequence.
- **"The catalog is complete. Do not guess tool names."** — the other branch, so the model
  knows not to search when everything is listed.
- **`execute`'s "Do not infer or normalize tool names; preserve bracket notation such as
  `tools.<namespace>["tool-name"](input)`."** — pins the exact call shape; models otherwise
  camelCase or guess the namespace separator.
- **The `update` deltas** (`codemode/instructions.ts:32-124`) render "supersede the
  previously listed ones", "no longer available and must not be called", and namespace
  changes ("search them again before relying on previous results"). These are the model-
  facing half of the instruction-delta machinery. The `removed` render closes the loop when
  Code Mode disappears entirely.

---

## Instructions

The instruction sources render into the system-prompt baseline and its chronological deltas.
Every source has an `initial` render (first appearance) and a `changed`/`removed` render
(later updates). The initial baseline is assembled in a fixed order so the prefix stays
cache-stable (`packages/core/src/session/context.ts:144-158`).

### A.41 Skill catalog render and update deltas

Provenance: `packages/core/src/skill/instructions.ts:25-33` (initial), `:35-58` (update).

```ts
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

Entries (`:16-23`, assembled per skill):

```text
  <skill>
    <id>${skill.id}</id>
    <name>${skill.name}</name>
    <description>${skill.description}</description>
  </skill>
```

Update (`:43-57`): if any skill changed, or nothing was added or removed, it restates the
full list under `The available skills have changed. This list supersedes the previous
available skills list.`; pure additions render `New skills are available in addition to those
previously listed:`; pure removals render
`The following skill IDs are no longer available and must not be used: ${ids}.` The `removed`
render (`:88`) is `Skill guidance is no longer available. Do not use any previously listed
skill.`

Design commentary:

- **"A skill that is already present this way does not need to be invoked again."** — the
  bridge to A.24's `<skill_content>` wrapper. Without it, a user-invoked skill is re-loaded
  by the tool, duplicating the payload.
- **Restate-on-change vs. small deltas.** A description change invalidates the catalog the
  model holds, so restating is correct; add/remove deltas are safe to express compactly.
  This is the same policy across all four instruction sources.
- **"must not be used"** in the removal delta — a strong prohibition, because a removed
  skill id may still be in recent history.

### A.42 Reference instructions

Provenance: `packages/core/src/reference/instructions.ts:23-29` (initial), `:31-54` (update).

```ts
const render = (references: ReadonlyArray<typeof Summary.Type>) =>
  [
    "Project references provide additional directories that can be accessed when relevant.",
    "<available_references>",
    ...entries(references),
    "</available_references>",
  ].join("\n")
```

Entries (`:14-21`):

```text
  <reference>
    <name>${reference.name}</name>
    <path>${reference.path}</path>
    <description>${reference.description}</description>
  </reference>
```

Update wording mirrors skills: full restatement under
`The available project references have changed. …`, additions under `New project references
are available …`, removals under `The following project references are no longer available
and must not be used: …`; `removed` (`:84-85`) is `Project reference guidance is no longer
available. Do not use previously listed references.`

Filled example:

```text
Project references provide additional directories that can be accessed when relevant.
<available_references>
  <reference>
    <name>effect</name>
    <path>/Users/kevinagnes/.local/share/opencode/repos/github.com/Effect-TS/effect-smol</path>
    <description>Use for Effect v4 and effect-smol implementation details</description>
  </reference>
</available_references>
```

Design commentary: references are *directories the model may treat as in-scope*. The opening
sentence is what grants that access; without it the model ignores the listed paths and stays
inside the working directory. The `<reference>` schema matches the skill block so the two
sources read consistently.

### A.43 MCP instruction block

Provenance: `packages/core/src/mcp/instructions.ts:17-29` (entries and render), `:31-54`
(update).

```ts
const render = (servers: ReadonlyArray<Summary>) =>
  ["<mcp_instructions>", ...entries(servers), "</mcp_instructions>"].join("\n")
```

Entries (`:17-26`, assembled):

```text
  <server name="${server.server}">
    Use tools from this server through `execute` under `tools[${JSON.stringify(McpTool.namespace(server.server))}]`.
    ${instructions line}
    ${instructions line}
  </server>
```

The `Use tools from this server through…` line is emitted only when `codemode !== false`.
Filled example:

```text
<mcp_instructions>
  <server name="context7">
    Use tools from this server through `execute` under `tools["context7"]`.
    When you need library documentation, use the resolve-library-id tool first.
  </server>
</mcp_instructions>
```

Update wording: full restatement under `The available MCP server instructions have changed.
This list supersedes the previous one.`; removals under `Instructions for the following MCP
servers are no longer available: ${servers}.`; `removed` (`:78`) is `MCP server instructions
are no longer available.`

Design commentary: MCP servers ship their own instructions; the render attributes each block
to a `<server name="…">` and, in CodeMode, tells the model the exact `tools[...]` path to
reach that server's tools. Without the path line the model cannot call a namespaced MCP tool.
The filter at `:84-103` drops servers whose tools are all permission-denied or whose
instructions cannot be reached, so the model never sees an instruction block for a server it
cannot use.

### A.44 Instruction-file discovery wrappers

Provenance: `packages/core/src/instruction-discovery.ts:123-125` (initial),
`:127-149` (update). The same `Instructions from:` prefix is used by the read-tool's
AGENTS.md injection at `packages/core/src/session/instructions.ts:76`.

```ts
function render(files: ReadonlyArray<File>) {
  return files.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n")
}
```

Filled example:

```text
Instructions from: /path/to/AGENTS.md
# AGENTS.md
…
```

Update (`:127-149`): removed files render `The instructions from ${file.path} no longer
apply.`; added files render `New instructions apply from:\n${render([file])}`; changed files
render either a unified diff —

```text
The instructions from ${after.path} changed. Here's the diff:
```diff
@@ ...
```
```

— or, when the diff is long, the full new text under `The instructions changed:\n…`. The
`removed` render (`:88`) is `Previously loaded instructions no longer apply.`

Design commentary:

- **The `Instructions from: <path>` prefix** is the same literal in two places (discovery and
  the read-tool's on-demand AGENTS.md injection). It makes instruction provenance legible to
  the model and to the transcript.
- **Diff-or-restate selection** (`diff.length < replacement.length`) chooses whichever is
  shorter. This keeps a one-line AGENTS.md change cheap while a large structure change is
  restated cleanly.

---

## Policy

### A.45 Permission block reason and related model-facing text

Provenance: `packages/core/src/permission.ts`. `BlockedError` `:70-79`; `DeclinedError`
`:64`; `CorrectedError` `:66-68`; the defect-tunnel comment `:247-253`. The `corrected`
feedback message is authored by the user; the decline path never becomes tool output.

```ts
// packages/core/src/permission.ts:70-79
export class BlockedError extends Schema.TaggedError<BlockedError>()("Permission.BlockedError", {
  rules: Permission.Ruleset,
  permission: Schema.String,
  resources: Schema.Array(Schema.String),
  reason: Schema.String.pipe(Schema.optional),
}) {
  override get message() {
    return this.reason ?? `Permission denied: ${this.permission}`
  }
}
```

```ts
// packages/core/src/permission.ts:247-253
return yield* restore(Deferred.await(item.deferred)).pipe(
  // Deliberate defect tunnel: leaves wrap execution in blanket `mapError`, which
  // must not convert a user's decline into model-facing tool output. The decline
  // resurfaces as a typed failure at SessionModelRequest.executeTool. A decline
  // WITH feedback (CorrectedError) intentionally stays typed so the leaf can turn
  // it into ToolFailure and the model continues.
  Effect.catchTag("Permission.DeclinedError", (error) => Effect.die(error)),
  …
```

Question-tool permission message (`packages/core/src/tool/plugin/question.ts:72`):
`Permission denied: question`.

Design commentary:

- **A denial never reaches the model as tool output.** `DeclinedError` is tunnelled as a
  defect (`Effect.die`) and recovered at `SessionModelRequest.executeTool`
  (`packages/core/src/session/model-request.ts:400-418`) as a typed failure that ends the
  step. If a decline were converted to tool output, the model would read "the user said no"
  as a normal tool result and could rationalise around it.
- **`BlockedError`'s `reason` override.** A configured deny rule may carry a human-authored
  reason; the getter prefers it over the generic `Permission denied: ${permission}`. This is
  the only permission denial the model may see, and it is for *rules*, not user declines.
- **`CorrectedError` is the exception.** A decline *with feedback* stays typed, so it
  becomes a `ToolFailure` with the user's message and the model continues with that feedback.
  This is the difference between "no" (end the step) and "no, do it this way" (keep going).
- The question tool's dismissal mirrors the decline tunnel (`question.ts:89-97`): a bare
  dismissal dies as `QuestionTool.CancelledError`; a dismissal with a message becomes a
  `ToolFailure`, i.e. ordinary model feedback.
