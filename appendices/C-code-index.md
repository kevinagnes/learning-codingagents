# Appendix C — Code index

A `file:line` map of the agentic core, grouped by Part 0 … Part 12 and then by topic. Use
it with [`D-glossary.md`](D-glossary.md) (the vocabulary) and
[`A-prompt-atlas.md`](A-prompt-atlas.md) (the prompts). Every anchor below was opened and
re-checked against the `opencode-dev` tree at version **2.0.31**.

The **Why it matters** column is deliberately short: it points at the concept each anchor
introduces, not the full explanation. The part files carry the explanation.

A note on layering, so the paths read correctly:

- `packages/schema` — browser-safe contracts (events, messages, request/response shapes).
- `packages/ai` — the model boundary: one canonical request/response, providers under
  `ai/src/providers`, protocols under `ai/src/protocols`.
- `packages/core` — the agent runtime and durable state.
- `packages/protocol` / `packages/server` — the HTTP surface (out of scope except Part 11).

---

## Part 0 — Orientation

### Architecture and scoping

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/location.ts:15` | `Location.Service` | The Location-scoped environment (directory, workspace, project, VCS). Most agent services are built per Location. |
| `packages/core/src/location.ts:19` | `layer` | How a `Location.Ref` becomes a `Location.Service` with a resolved project. |
| `packages/core/src/location-service-map.ts:9` | `LocationServiceMap.Service` | The `LayerMap<Location.Ref, Instance.Services>`; `Service.get(ref)` is how a Session finds its instance. |
| `packages/core/src/location-service-map.ts:39` | `canonical` | Normalises equivalent placements before they become cache keys. |
| `packages/core/src/location-lifecycle.ts:17` | `LocationLifecycle.Service` | `isClosed()`/`shutdown`; the flag the loop reads to stop touching a closing Location. |
| `packages/core/src/state.ts:160` | `State.create` | The replayable-transform store every registry (tools, agents, skills, MCP) is built on. |
| `packages/core/src/tool.ts:65` | `Tool.Service` | The Location-scoped tool registry. |
| `packages/core/src/session/session.ts:42` | `Session.make` | The public Session handle: prompt, compact, interrupt, revert, inbox mutations. |
| `packages/core/src/bus.ts:172` | `Bus.Service` | Publish/subscribe + durable projectors + ordered log. |
| `packages/core/src/session/execution.ts:46` | `SessionExecution.Service` | Process-global, Session-ID-keyed execution entry point. |
| `packages/core/src/session/run-coordinator.ts:60` | `make` | One execution per key; the doorbell. |

---

## Part 1 — The model boundary

### Canonical request and response

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/ai/src/llm.ts:39` | `generate` | One model call, non-streaming, canonical `LLMResponse`. |
| `packages/ai/src/llm.ts:48` | `stream` | One model call, streaming `LLMEvent`. |
| `packages/ai/src/llm.ts:60` | `request` | Normalises a `RequestInput` into the canonical `LLMRequest`. |
| `packages/ai/src/schema/messages.ts:237` | `Message` | The canonical provider message class. |
| `packages/ai/src/schema/messages.ts:226` | `ContentPart` | The content union: text, media, tool-call, tool-result, reasoning, compaction, effort. |
| `packages/ai/src/schema/messages.ts:300` | `ToolDefinition` | The model-facing tool definition (name, description, JSON schemas). |
| `packages/ai/src/schema/messages.ts:361` | `ToolChoice` | `auto`/`none`/`required`/named; the step limit uses `none`. |
| `packages/ai/src/schema/messages.ts:401` | `LLMRequest` | The request class; `LLMRequest.update` is used throughout compaction. |
| `packages/ai/src/schema/messages.ts:22` | `SystemPart` | One system-prompt segment; the cache-stable baseline is an ordered `SystemPart[]`. |
| `packages/ai/src/schema/messages.ts:19` | `MessageRole` | system/user/assistant/tool; explains why checkpoints lower as `user`. |
| `packages/ai/src/tool.ts:135` | `Tool.make` | The AI-package tool constructor (typed and dynamic modes). |
| `packages/ai/src/tool.ts:223` | `toDefinitions` | Converts a tools record into the wire `ToolDefinition[]`. |

### Streaming events and finish reasons

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/ai/src/schema/events.ts:307` | `llmEventTagged` | The full streaming event union. |
| `packages/ai/src/schema/events.ts:342` | `LLMEvent` | camelCase constructors and `LLMEvent.is.*` guards. |
| `packages/ai/src/schema/events.ts:264` | `FinishReasonDetails` | Normalised + raw finish reason + content-filter category/explanation. |
| `packages/schema/src/llm.ts:5` | `FinishReason` | `stop`/`length`/`tool-calls`/`content-filter`/`error`/`unknown`. |
| `packages/ai/src/schema/events.ts:65` | `Usage` | Inclusive totals + non-overlapping breakdown; `visibleOutputTokens` is the only subtraction. |
| `packages/ai/src/schema/events.ts:685` | `LLMResponse` | Assembled non-streaming view; `toolCalls`, `text`, `reasoning`. |
| `packages/ai/src/schema/events.ts:718` | `LLMResponse.complete` | Only completes on a terminal finish or provider error. |
| `packages/ai/src/schema/events.ts:230` | `ToolCall` | Streamed tool call with final `input`. |
| `packages/ai/src/schema/events.ts:190` | `ToolInputStart` | Partial-tool-input streaming begins here. |

### Error taxonomy

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/ai/src/schema/errors.ts:158` | `AIError` | The top-level typed failure; `reason` is the tagged union. |
| `packages/ai/src/schema/errors.ts:142` | `AIErrorReason` | The full reason union (rate limit, transport, invalid output, …). |
| `packages/ai/src/schema/errors.ts:118` | `TransportError.recovery` | `retry-full`/`rotate-and-retry-full`/… drives recover-full vs retry. |
| `packages/ai/src/schema/errors.ts:123` | `InvalidProviderOutputError` | `incomplete-stream` classification drives the continue path. |
| `packages/ai/src/schema/errors.ts:177` | `ToolFailure` | The only error a tool handler may yield. |

### Output budgeting and provider context

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/model-request.ts:88` | `outputLimit` | Catalog limit fitted to the room the prompt leaves in the window. |
| `packages/core/src/session/model-request.ts:43` | `IMAGE_BYTES_TRIGGER` / `IMAGE_BYTES_TARGET` | The inline-image budgets (25 MiB → 15 MiB). |
| `packages/core/src/session/model-request.ts:189` | `boundImages` | Replaces oversized images with `IMAGE_REMOVED`. |
| `packages/core/src/session/model-request.ts:183` | `unsupportedParts` | Replaces media a model cannot read with an error string. |
| `packages/core/src/session/provider-context.ts:18` | `provenance` | Durable deployment identity; guards native-window replay. |
| `packages/core/src/session/provider-context.ts:42` | `isCheckpoint` | A native (provider-executed) compaction checkpoint. |
| `packages/core/src/session/runner/model.ts:46` | `resolved` | Builds a `Resolved` model (ref, capabilities, cost, limit, compaction, transport). |

---

## Part 2 — Durable state

### Sessions, history, read models

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/session.ts:31` | `Session.Info` | The projected Session row (agent, model, cost, tokens, times, permissions, revert). |
| `packages/core/src/session/sql.ts:22` | `SessionTable` | The `session_v2` table; `time_suspended` is the claim, `idle_outcome` the terminal. |
| `packages/core/src/session/sql.ts:79` | `SessionMessageTable` | The projected message row: `type` + `seq` + JSON `data`. |
| `packages/core/src/session/sql.ts:125` | `SessionInboxTable` | The pending-only inbox table. |
| `packages/core/src/session/sql.ts:162` | `InstructionBlobTable` | Content-addressed instruction values. |
| `packages/core/src/session/store.ts:53` | `SessionStore.Interface` | Durable session reads and claim/release. |
| `packages/core/src/session/store.ts:205` | `claim` | Write-ahead execution claim; a surviving claim marks a crashed turn. |
| `packages/core/src/session/store.ts:217` | `release` | Clears the claim and resume accounting on a terminal. |
| `packages/core/src/session/history.ts:110` | `SessionHistory.load` | Reads projected messages under a compaction boundary. |
| `packages/core/src/session/history.ts:118` | `entriesForRunner` | History + the rendered instruction baseline, in one transaction. |
| `packages/core/src/session/history.ts:21` | `Boundary` | `latest`/`local`/provenance: which compaction bounds a read. |
| `packages/schema/src/session-message.ts:297` | `SessionMessage.Info` | The projected message union. |
| `packages/schema/src/session-message.ts:213` | `Assistant` | The assistant message: content parts, snapshot, finish, usage, error, retry. |
| `packages/schema/src/session-message.ts:289` | `Idle` | Marks the Session going idle; defines the conceptual turn. |

### Events, bus, projector

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/session-event.ts:652` | `Definitions` | The public event inventory. |
| `packages/schema/src/session-event.ts:705` | `DurableDefinitions` | Durable + replay-only durable events. |
| `packages/schema/src/session-event.ts:714` | `Durable` | The durable event tagged union. |
| `packages/schema/src/session-event.ts:239` | `Execution` | `Started`/`Succeeded`/`Failed`/`Interrupted`. |
| `packages/schema/src/session-event.ts:328` | `Step` | `Started`/`Streamed`/`Ended`/`Failed`. |
| `packages/schema/src/session-event.ts:468` | `Tool` | Input, Called, Progress, Success, Failed. |
| `packages/schema/src/session-event.ts:582` | `Compaction` | Started/Delta/Ended/Failed. |
| `packages/schema/src/session-event.ts:208` | `InboxDelivered` | Consumes an inbox row and inserts the message. |
| `packages/schema/src/session-event.ts:215` | `InboxEnqueued` | The admission event that inserts the inbox row. |
| `packages/core/src/bus.ts:139` | `Bus.Interface` | publish/publishAll/subscribe/log/project/replay/claim. |
| `packages/core/src/bus.ts:284` | `commitDurableEvent` | The per-aggregate transaction: projectors, `commit`, sequence, persistence. |
| `packages/core/src/bus.ts:531` | `publishAll` | Multi-event atomic publish on one aggregate. |
| `packages/core/src/bus.ts:828` | `log` | Ordered durable log read with a replay/live `Synced` marker. |
| `packages/core/src/bus.ts:882` | `project` | Registers a projector for an event definition. |
| `packages/core/src/session/projector.ts:443` | `layer` | All Session event → read-model projections. |
| `packages/core/src/session/projector.ts:395` | `insertMessage` | Sequences a projected message from the event's durable `seq`. |
| `packages/core/src/session/projector.ts:680` | `Execution.*` projections | Terminal events set `time_idle`/`idle_outcome`. |

### The inbox

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/session-inbox.ts:11` | `Delivery` | `steer` | `queue`. |
| `packages/schema/src/session-inbox.ts:46` | `Item` | user/synthetic/compaction/move. |
| `packages/core/src/session/inbox.ts:48` | `Promotable` | `input` vs `steer` scope. |
| `packages/core/src/session/inbox.ts:169` | `admit` | Publishes `InboxEnqueued`; first admission wins. |
| `packages/core/src/session/inbox.ts:324` | `projectDelivered` | Deletes the row and returns it; pending-only by construction. |
| `packages/core/src/session/inbox.ts:496` | `promote` | Steer priority, control boundaries, one queued item at idle. |
| `packages/core/src/session/inbox.ts:533` | `pendingSteers` | Reorders a steered compaction ahead of earlier steers. |
| `packages/core/src/session/inbox.ts:407` | `nextPromotable` | The eligibility probe `drain` uses. |

---

## Part 3 — The agent loop

### Drain / step / attempt

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/index.ts:23` | `DrainResult` | `Complete`/`Moved`/`Reloaded`. |
| `packages/core/src/session/runner/index.ts:31` | `SessionRunner.Interface` | The one method, `drain`. |
| `packages/core/src/session/runner/llm.ts:57` | `drain` | Loads/advances/settles until idle; the outer loop at `:191-198`. |
| `packages/core/src/session/runner/llm.ts:74` | `advanceToStep` | Uninterruptible preparation: stale settlement, controls, promotion, load. |
| `packages/core/src/session/runner/llm.ts:201` | `prepareContext` | `select` + instruction state preparation. |
| `packages/core/src/session/runner/llm.ts:209` | `runStep` | Owns Step policy; calls `attempt`, decides continuation. |
| `packages/core/src/session/runner/llm.ts:226` | step-limit branch | Appends `MAX_STEPS_PROMPT` and `toolChoice: none`. |
| `packages/core/src/session/runner/llm.ts:332` | `settleStaleCompactions` | Crash recovery for orphaned running compactions. |
| `packages/core/src/session/runner/llm.ts:362` | `settleStaleToolCalls` | Crash recovery for streaming/running tool calls. |
| `packages/core/src/session/runner/step.ts:32` | `Outcome` | Completed/Retry/Continue/RecoverFull/Compacted/OutputLimit. |
| `packages/core/src/session/runner/step.ts:73` | `SessionStep.attempt` | One try: stream, tool fibers, durable settlement. |
| `packages/core/src/session/runner/step.ts:76` | start snapshot | Captured concurrently, awaited before `Step.Started`. |
| `packages/core/src/session/runner/step.ts:103` | tool-fiber fan-out | Per-source order without a shared writer queue. |
| `packages/core/src/session/runner/step.ts:141` | uninterruptible settlement | Final tool and step events survive cancellation. |
| `packages/core/src/session/runner/step.ts:263` | `OutputLimit` outcome | `finish === "length"` → output-limit continuation. |
| `packages/core/src/session/runner/publish-llm-event.ts:105` | `createLLMEventPublisher` | The sole writer of step/tool events; concurrency invariants at `:92-104`. |
| `packages/core/src/session/runner/publish-llm-event.ts:653` | `record` | Immutable `StepRecord` folded from durable facts. |

### Continuation prompts

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/max-steps.ts:1` | `MAX_STEPS_PROMPT` | The step-limit assistant message. |
| `packages/core/src/session/runner/llm.ts:35` | `CONTINUE_AFTER_INCOMPLETE_STREAM` | Resume a truncated stream. |
| `packages/core/src/session/runner/llm.ts:38` | `CONTINUE_AFTER_OUTPUT_LIMIT` | Resume after a `length` finish. |
| `packages/core/src/session/runner/step.ts:92` | tools-disabled guard | Enforces `toolChoice: none` at execution. |

---

## Part 4 — Context assembly

### Select and load

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/context.ts:29` | `Selection` | Session + agent + instructions + tool snapshot. |
| `packages/core/src/session/context.ts:36` | `Loaded` | Selection + model + initial + messages. |
| `packages/core/src/session/context.ts:121` | `select` | Fixes the selection; loads all instruction sources concurrently. |
| `packages/core/src/session/context.ts:144` | instruction order | Most-shared first: codemode, MCP, references, skills, discovery, builtins, entries. |
| `packages/core/src/session/context.ts:163` | `load` | Resolves the model and active history for a selection. |

### System prompt and instruction sources

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/prompt/system.txt:1` | base prompt | See Appendix A.1. |
| `packages/core/src/session/system-prompt.ts:9` | `render` | The `${OPENCODE_TOOL_GUIDANCE}` conditional splice. |
| `packages/core/src/instructions/index.ts:88` | `Instructions.make` | Closes a typed definition into a composable source. |
| `packages/core/src/instructions/index.ts:124` | `combine` | Ordered composition; duplicate keys throw. |
| `packages/core/src/instructions/index.ts:142` | `diff` | Observed → hash delta + blobs. |
| `packages/core/src/instructions/index.ts:207` | `diffByKey` | The shared add/remove/change differ. |
| `packages/core/src/instructions/builtins.ts:24` | date source | Appendix A.4. |
| `packages/core/src/instructions/builtins.ts:33` | environment source | Appendix A.5. |
| `packages/schema/src/instruction.ts:5` | `Key` | The `a/b` instruction key brand. |
| `packages/schema/src/instruction.ts:24` | `Delta` | `Record<key, hash | "removed">`. |
| `packages/core/src/session/instruction-state.ts:21` | `observe` | Reads sources and diffs against stored state. |
| `packages/core/src/session/instruction-state.ts:38` | `commit` | Freezes rendered text into `InstructionsUpdated`. |
| `packages/core/src/session/instruction-state.ts:165` | `initial` | Renders the epoch baseline for every request. |
| `packages/core/src/session/instruction-state.ts:139` | `advanceEpoch` | A completed compaction advances the instruction epoch. |
| `packages/core/src/session/instruction-entry.ts:90` | entry source | `api/<key>` sources from session context entries. |
| `packages/core/src/instruction-discovery.ts:123` | `render` | `Instructions from: <path>` wrapper. |
| `packages/core/src/instruction-discovery.ts:127` | `renderUpdate` | Diff-or-restate instruction update. |
| `packages/core/src/session/instructions.ts:46` | on-demand AGENTS.md | Read-tool discovery injects synthetic instructions. |

### Skills, references, MCP

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/skill.ts:36` | `Skill.toModelOutput` | The `<skill_content>` payload (Appendix A.24). |
| `packages/core/src/skill.ts:55` | `prepare` | Samples up to 10 skill files. |
| `packages/core/src/skill/instructions.ts:25` | skill catalog render | Appendix A.41. |
| `packages/core/src/skill/instructions.ts:35` | skill catalog update | Restate-on-change, delta on add/remove. |
| `packages/core/src/reference/instructions.ts:23` | reference render | Appendix A.42. |
| `packages/core/src/mcp/instructions.ts:17` | MCP entries | Server block + CodeMode path line. |
| `packages/core/src/mcp/instructions.ts:69` | `load` | Filters servers the Session cannot reach. |

### Lowering to provider messages

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/to-llm-message.ts:330` | `toLLMMessages` | Enters lowering. |
| `packages/core/src/session/runner/to-llm-message.ts:253` | `toLLMMessage` | The per-type switch. |
| `packages/core/src/session/runner/to-llm-message.ts:260` | location-switched | Hardcoded user wrapper (Appendix A.39). |
| `packages/core/src/session/runner/to-llm-message.ts:287` | synthetic | Passed through as `user`. |
| `packages/core/src/session/runner/to-llm-message.ts:293` | shell | "executed by the user" wrapper. |
| `packages/core/src/session/runner/to-llm-message.ts:311` | compaction | The `<conversation-checkpoint>` wrapper (Appendix A.18). |
| `packages/core/src/session/runner/to-llm-message.ts:153` | `assistant` | Provider-metadata replay rules (Gemini/OpenAI/hosted). |
| `packages/core/src/session/runner/to-llm-message.ts:194` | hosted-tool metadata | Result payload replayable across models; call-side is not. |
| `packages/core/src/session/model-request.ts:100` | `baseTranscript` | System parts + lowered messages. |

### Agents

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/agent.ts:23` | `Agent.Info` | id, name, model, request, system, mode, steps, permissions. |
| `packages/schema/src/agent.ts:38` | `Agent.Info.default` | Default permissions (allow `*`, ask for `.env`). |
| `packages/core/src/agent.ts:98` | `Agent.select` | Resolves the agent for a Session. |
| `packages/core/src/agent.ts:13` | `defaultID` | `build`. |
| `packages/core/src/session/model-request.ts:110` | system assembly | Agent `system` overrides the base prompt. |

---

## Part 5 — Tools

### Contract and registry

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/tool.ts:92` | `Tool.Info` | The registration shape: name, options, input, output, execute. |
| `packages/schema/src/tool.ts:32` | `Tool.Options` | namespace, permission, codemode, pinned. |
| `packages/schema/src/tool.ts:61` | `Tool.Error` | The declared tool failure. |
| `packages/schema/src/tool.ts:86` | `Tool.Result` | Model content + machine output + metadata. |
| `packages/core/src/tool.ts:51` | `Snapshot` | Per-request capture of definitions + executor. |
| `packages/core/src/tool.ts:225` | `Tool.snapshot` | Builds the direct list and CodeMode catalog. |
| `packages/core/src/tool.ts:263` | `Snapshot.execute` | Executes a call against the captured definitions. |
| `packages/core/src/tool.ts:292` | `whollyDisabled` | Catalog-visibility filter, not authorization. |
| `packages/core/src/tool.ts:304` | `registrationError` | Name/namespace validation; `execute` is reserved. |
| `packages/core/src/tool/runtime.ts:21` | `definition` | Tool → wire definition. |
| `packages/core/src/tool/runtime.ts:29` | `execute` | Decode, run, encode, normalise; enforces the `Tool.Error` contract. |
| `packages/core/src/tool/runtime.ts:88` | `formatInputIssues` | The input-validation error (Appendix A.36). |
| `packages/core/src/tool/runtime.ts:278` | `effectiveName` | Namespace flattening; non-alphanumerics to `_`. |
| `packages/core/src/tool-output.ts:67` | `truncate` | Head-plus-marker output bounding. |

### Built-in tool leaves

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/tool/plugin/read.ts:29` | read Plugin | File/dir read, AGENTS.md discovery. |
| `packages/core/src/tool/plugin/grep.ts:64` | grep Plugin | ripgrep content search. |
| `packages/core/src/tool/plugin/glob.ts:45` | glob Plugin | ripgrep path search. |
| `packages/core/src/tool/plugin/edit.ts:207` | edit Plugin | Exact-text replacement. |
| `packages/core/src/tool/plugin/write.ts:46` | write Plugin | Whole-file write. |
| `packages/core/src/tool/plugin/patch.ts:67` | patch Plugin | Multi-hunk patch apply. |
| `packages/core/src/tool/plugin/patch.ts:296` | patch hook | Model-dependent exposure of patch vs edit/write. |
| `packages/core/src/tool/plugin/shell.ts:103` | shell Plugin | Foreground/background command execution. |
| `packages/core/src/tool/plugin/webfetch.ts:103` | webfetch Plugin | Read-only HTTP fetch. |
| `packages/core/src/tool/plugin/websearch.ts:32` | websearch Plugin | Provider-selected web search. |
| `packages/core/src/tool/plugin/subagent.ts:64` | subagent Plugin | Child session + depth limit + job. |
| `packages/core/src/tool/plugin/question.ts:48` | question Plugin | Structured mid-execution questions. |
| `packages/core/src/tool/plugin/skill.ts:32` | skill Plugin | Loads a skill's instructions/resources. |
| `packages/core/src/tool/plugin/opencode.ts:87` | opencode Plugin | Namespace of session/worktree/models/MCP tools. |
| `packages/core/src/tool/plugin/mcp-resource.ts:9` | mcp-resource Plugin | `list_mcp_resources` / `read_mcp_resource`. |

### CodeMode

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/codemode/tool.ts:71` | `create` | The single `execute` tool. |
| `packages/core/src/codemode/tool.ts:62` | `description` | The invariant Code Mode guidance (Appendix A.40). |
| `packages/core/src/codemode/tool.ts:178` | `catalog` | Builds the renderable catalog inventory. |
| `packages/core/src/codemode/catalog.ts:54` | `summarize` | Budgeted catalog selection. |
| `packages/core/src/codemode/catalog.ts:165` | `namespaceLine` | The `- name (N tools)` line. |
| `packages/core/src/codemode/instructions.ts:9` | prompt | The Code Mode instruction text. |
| `packages/core/src/codemode/instructions.ts:19` | `render` | Initial catalog render. |
| `packages/core/src/codemode/instructions.ts:32` | `update` | Catalog delta (Appendix A.40). |
| `packages/core/src/codemode/web.ts:42` | `fetch` extension | The only CodeMode network surface. |

### MCP and plugins as tool sources

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/tool/mcp.ts:16` | `namespace`/`name` | MCP server → tool namespace/action name. |
| `packages/core/src/tool/mcp.ts:26` | `layer` | Registers MCP tools; debounced reload on change. |
| `packages/core/src/tool/mcp.ts:99` | output coercion | Parses JSON text only when the server declares no schema. |
| `packages/core/src/plugin/hooks.ts:1` | `PluginHooks` | The transform/hook registration substrate tools and plugins use. |

---

## Part 6 — Permissions and human-in-the-loop

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/schema/src/permission.ts:60` | `Permission.Rule` | action/resource/effect. |
| `packages/schema/src/permission.ts:66` | `Permission.Ruleset` | The ordered rule list; last match wins. |
| `packages/schema/src/permission.ts:42` | `Permission.Reply` | `once`/`always`/`reject`. |
| `packages/core/src/permission.ts:64` | `DeclinedError` | A bare decline; tunnelled as a defect. |
| `packages/core/src/permission.ts:66` | `CorrectedError` | A decline **with feedback**; stays typed. |
| `packages/core/src/permission.ts:70` | `BlockedError` | A rule deny; the only model-visible denial. |
| `packages/core/src/permission.ts:87` | `evaluate` | Last matching rule wins; default `ask`. |
| `packages/core/src/permission.ts:99` | `merge` | Agent rules then Session rules. |
| `packages/core/src/permission.ts:158` | `configured` | Builds the effective ruleset for a request. |
| `packages/core/src/permission.ts:231` | `assert` | ask/allow/deny; the defect tunnel at `:247-253`. |
| `packages/core/src/permission.ts:265` | `reply` | Settles a pending request; `always` saves and cascades. |
| `packages/core/src/permission/saved.ts:63` | `PermissionSaved.add` | Persists an `always` rule per project. |
| `packages/core/src/form.ts:85` | `Form.Interface` | create/ask/get/list/state/reply/cancel. |
| `packages/core/src/form.ts:152` | `ask` | Blocks on a terminal form state. |
| `packages/core/src/form.ts:180` | `reply` | Answers a form; validates first. |
| `packages/core/src/form.ts:276` | `validateFields` | Create-time validation of `when` references. |
| `packages/core/src/session/model-request.ts:404` | `executeTool` decline recovery | Resurfaces the defect as a typed `ExecuteError`. |
| `packages/core/src/tool/plugin/question.ts:89` | question dismissal | Decline tunnel for questions. |
| `packages/core/src/session/runner/step.ts:207` | decline settlement | Declines fail the tool call, then interrupt the step. |

---

## Part 7 — Compaction

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/compaction.ts:41` | `Settings` | auto, buffer, keep. |
| `packages/core/src/session/compaction.ts:53` | `Trigger` | `auto`/`overflow`/`manual`. |
| `packages/core/src/session/compaction.ts:59` | `Outcome` | skipped/completed/failed. |
| `packages/core/src/session/compaction.ts:95` | `SHRINK_STEPS` | 0.7/0.5/0.35 of the first rejected request. |
| `packages/core/src/session/compaction.ts:104` | `SUMMARY_TEMPLATE` | Appendix A.11. |
| `packages/core/src/session/compaction.ts:137` | `SUMMARY_RULES` | Appendix A.12. |
| `packages/core/src/session/compaction.ts:145` | `buildPrompt` | Initial vs update, with legacy rewrite. |
| `packages/core/src/session/compaction.ts:178` | `NUDGE` | One reminder on a malformed summary. |
| `packages/core/src/session/compaction.ts:205` | `compact` | Decides due, model, budget; routes native vs summary. |
| `packages/core/src/session/compaction.ts:242` | `due` | Auto-trigger condition. |
| `packages/core/src/session/compaction.ts:272` | `summarize` | Split, prompt, send, nudge, fail. |
| `packages/core/src/session/compaction.ts:330` | `compactNatively` | Provider-executed replacement window. |
| `packages/core/src/session/compaction.ts:390` | `deliver` | Fit, send, shrink on rejection, retry. |
| `packages/core/src/session/compaction.ts:471` | `flattenAndDropOldest` | Last-resort transcript flattening. |
| `packages/core/src/session/compaction.ts:708` | `splitConversation` | Older (summarised) vs recent (kept verbatim). |
| `packages/core/src/session/compaction.ts:880` | `estimatePrompt` | Measured + estimated prompt size. |
| `packages/core/src/session/compaction.ts:911` | `calculateCeiling` | Window minus reserve (10% or 16k). |
| `packages/core/src/session/compaction.ts:939` | `fitOutput` | Lowers the summary output limit to fit. |
| `packages/core/src/session/provider-context.ts:51` | `encode` | Stores the native replacement window. |

---

## Part 8 — Reliability

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/retry.ts:45` | `schedule` | 2s→10s expontential, 10 retries, honoured `retry-after`. |
| `packages/core/src/session/runner/retry.ts:60` | `MAX_TIMEOUT_RETRIES` | Caps timeout retries below the general allowance. |
| `packages/core/src/session/runner/retry.ts:64` | `policy` | Consult the session `retry` hook; produce a `Decision`. |
| `packages/core/src/session/runner/retry.ts:94` | `make` | `decide` + `wait` (publishes `RetryScheduled`). |
| `packages/core/src/session/runner/step.ts:180` | `llmFailure` | Distinguishes provider failure from unknown finish. |
| `packages/core/src/session/runner/step.ts:182` | `RecoverFull` | Transport `retry-full` with no output yet. |
| `packages/core/src/session/runner/step.ts:200` | `Retry` | Retry only before output started. |
| `packages/core/src/session/runner/step.ts:263` | `Continue` | Retry after output started. |
| `packages/core/src/session/runner/step.ts:155` | overflow recovery | Provider overflow before output → compact. |
| `packages/core/src/session/to-session-error.ts:28` | `toSessionError` | The canonical error taxonomy mapping. |
| `packages/core/src/session/to-session-error.ts:88` | `contentFilterError` | Content-filter message assembly. |
| `packages/core/src/session/error.ts:45` | `StepFailedError` | Wraps a `SessionError.Error` from a step. |
| `packages/core/src/session/runner/publish-llm-event.ts:41` | `INPUT_FAILURES` | Malformed/length/incomplete tool-input errors. |
| `packages/core/src/session/runner/llm.ts:290` | output-limit streak | Three `length` finishes → terminal `output-limit`. |
| `packages/core/src/session/execution.ts:50` | `terminal` | Maps an exit to succeeded/interrupted/failed. |

---

## Part 9 — Concurrency and sessions

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/run-coordinator.ts:40` | `Execution` | One busy period; `pendingWake` is the doorbell. |
| `packages/core/src/session/run-coordinator.ts:74` | `loop` | Drain, then re-drain on a rung doorbell. |
| `packages/core/src/session/run-coordinator.ts:116` | `settle` | A surviving doorbell starts a successor execution. |
| `packages/core/src/session/run-coordinator.ts:136` | `wake` | Coalesces wakes, widest scope wins. |
| `packages/core/src/session/run-coordinator.ts:147` | `interrupt` | Claims recorded wakes; new admissions restart. |
| `packages/core/src/session/execution.ts:76` | write-ahead claim comment | The claim/release/shutdown rule. |
| `packages/core/src/session/execution.ts:111` | `coordinator` | started/drain/settled wiring. |
| `packages/core/src/session/execution.ts:153` | `interrupt` | Resume steers after interruption. |
| `packages/core/src/session/session.ts:145` | `Session.prompt` | Admission, then advisory `wake`. |
| `packages/core/src/session/session.ts:134` | `steerInbox` | Steer + wake. |
| `packages/core/src/session/move.ts:119` | `move` | Queues a move control; cancels pending moves for a dead source. |
| `packages/core/src/session/subagent-job.ts:12` | `SubagentJob.Interface` | Durable background-subagent recovery records. |
| `packages/core/src/session/subagent-completion.ts:21` | `SubagentCompletion.deliver` | Completion notification for a background child. |
| `packages/core/src/tool/plugin/subagent.ts:129` | depth limit | `experimental.subagent_depth` (default 1). |
| `packages/core/src/tool/plugin/subagent.ts:200` | background admission | `resume: false` admits without executing. |

---

## Part 10 — Snapshots and change tracking

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/snapshot.ts:43` | `Snapshot.Interface` | capture/files/diff/restore. |
| `packages/core/src/snapshot.ts:128` | `capture` | Content-addressed tree of the working scope. |
| `packages/core/src/snapshot.ts:166` | `files` | Changed paths between two trees. |
| `packages/core/src/snapshot.ts:175` | `diff` | Per-file diffs between two trees. |
| `packages/core/src/snapshot.ts:207` | `restore` | Restore selected paths. |
| `packages/core/src/session/diff.ts:38` | `turn` | Diff the files changed by a turn. |
| `packages/core/src/session/revert.ts:21` | `stage` | Capture original, plan, restore, publish `Staged`. |
| `packages/core/src/session/revert.ts:84` | `plan` | Per-file earliest start snapshot after a boundary. |
| `packages/core/src/session/revert.ts:76` | `commit` | Publish `RevertEvent.Committed`. |
| `packages/core/src/session/projector.ts:759` | revert projection | Deletes messages/inbox at/after the boundary. |
| `packages/core/src/file-mutation.ts:1` | `FileMutation` | Locked, BOM-preserving writes. |
| `packages/schema/src/session-message.ts:219` | `Assistant.snapshot` | Per-step start/end snapshot and changed files. |

---

## Part 11 — Observability and API

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/bus.ts:121` | `Bus.Subscribe` | The live channel (Location-scoped). |
| `packages/core/src/bus.ts:726` | `local` | Location filter for the live stream. |
| `packages/core/src/bus.ts:764` | `readAfter` | Paged durable log read; skips undecodable types. |
| `packages/protocol/src/api.ts:200` | `makeApi` | Builds the `HttpApi` from groups + event definitions. |
| `packages/protocol/src/api.ts:137` | `makeApiFromGroup` | Middleware placement: Location, Form, Session Location. |
| `packages/protocol/src/groups/session.ts:176` | `makeSessionGroup` | The session drive/observe endpoints. |
| `packages/protocol/src/groups/event.ts:59` | `makeEventGroup` | The SSE event-feed group (`EventGroup` at `:63`). |
| `packages/server/src/event-feed.ts:33` | `make` | Bus subscription → per-subscriber SSE queue. |
| `packages/server/src/event-feed.ts:29` | `frame` | `data: <json>\n\n`. |
| `packages/server/src/event-feed.ts:8` | `SubscriberCapacity` | 4096; overflow fails the subscriber (no silent drop). |
| `packages/schema/src/event.ts:90` | `Event.durable` | The durable event combinator (`ephemeral` `:128`, `inventory` `:152`). |
| `packages/schema/src/event.ts:174` | `Event.versionedType` | Versioned type name stamped on persisted events. |
| `packages/schema/src/durable-event-manifest.ts:7` | `Durable` | The durable manifest used to decode persisted events. |

---

## Part 12 — Build it yourself

| Anchor | Symbol | Why it matters |
|---|---|---|
| `packages/core/src/session/runner/llm.ts:191` | outer loop | The minimal shape: advance, run a step, repeat until not Ready. |
| `packages/core/src/session/runner/step.ts:73` | `attempt` | The minimal step: stream, fan out tools, settle. |
| `packages/core/src/session/run-coordinator.ts:32` | doorbell comment | The one-sentence explanation of the coordinator. |
| `packages/core/src/session/inbox.ts:490` | `promote` comment | Steer priority and control boundaries in one paragraph. |
| `packages/core/src/session/model-request.ts:88` | `outputLimit` | The output budget in one function. |
| `packages/core/src/permission.ts:231` | `assert` | Gate a tool without leaking a decline into context. |
| `packages/core/src/session/history.ts:16` | boundary comment | Why a compaction bounds a history read. |
| `packages/core/src/state.ts:18` | transform comment | The replayable-registry pattern every dynamic source uses. |

---

## Entry points and the read order

Open these first. The order below is a working path: each file is meaningful on its own and
points at the next.

1. `packages/core/src/session/runner/llm.ts` — the loop: `drain`, `advanceToStep`, `runStep`.
   Read this first and hold `DrainResult` in mind.
2. `packages/core/src/session/runner/step.ts` — one attempt, one LLM call, its tool fibers,
   and its settlement.
3. `packages/core/src/session/runner/index.ts` — `DrainResult` and the `SessionRunner`
   interface the loop implements.
4. `packages/core/src/session/run-coordinator.ts` — one execution per Session and the
   doorbell that coalesces wakes.
5. `packages/core/src/session/execution.ts` — the process-global entry point: claim, drain,
   terminal.
6. `packages/core/src/session/inbox.ts` — admission and promotion; `steer`/`queue`.
7. `packages/core/src/session/projector.ts` — how each event folds into a read model.
8. `packages/core/src/bus.ts` — publish, project, ordered log.
9. `packages/schema/src/session-event.ts` — the durable event inventory you will keep
   consulting.
10. `packages/schema/src/session-message.ts` — the projected message union.
11. `packages/core/src/session/context.ts` — `select` then `load`; context assembly.
12. `packages/core/src/session/runner/to-llm-message.ts` — lowering history to provider
    messages.
13. `packages/core/src/session/model-request.ts` — building the canonical request and the
    output budget.
14. `packages/core/src/tool.ts` and `packages/core/src/tool/runtime.ts` — the tool registry
    snapshot and the execution boundary.
15. `packages/core/src/session/compaction.ts` — the shrink loop, the summary prompt, and
    checkpoints.
16. `packages/core/src/permission.ts` — ask/allow/deny and the defect tunnel.

For the model boundary itself, add `packages/ai/src/schema/messages.ts` (canonical
request/response) and `packages/ai/src/schema/events.ts` (streaming events).

---

## Deprecated / compatibility paths

Do not read these to understand the current agent. They are retained for persistence,
migration, or replay, and current code must not depend on them.

| Path | What it is | Note |
|---|---|---|
| `packages/core/src/v1/config/` | V1 config loaders (`agent.ts`, `provider.ts`, `permission.ts`, `mcp.ts`, `plugin.ts`, `command.ts`, `migrate.ts`, `provider-options.ts`, `error.ts`) | Old config schema and migration. Read the current `packages/core/src/config.ts` instead. |
| `packages/schema/src/v1/session.ts` | `SessionV1` contract | Superseded by `packages/schema/src/session.ts`. |
| `packages/schema/src/v1/permission.ts` | `PermissionV1` contract | Superseded by `packages/schema/src/permission.ts`. |
| `packages/schema/src/v1/filesystem.ts` | V1 filesystem contract | Superseded by `packages/schema/src/filesystem.ts`. |
| `packages/schema/src/v1/legacy-event.ts` | V1 event shapes (`message.updated`, `message.part.*`) | V1-only; excluded from the current Protocol/SDK event surface. |
| `packages/schema/src/session-v1.ts`, `permission-v1.ts`, `filesystem-v1.ts`, `legacy-event.ts` | Thin re-export shims (`export * from "./v1/…"`) | Compatibility entrypoints only. |
| `packages/core/src/bus.ts:161` | `Bus.listen` | Marked `@deprecated`; use `subscribe()` and consume the stream. |
| `packages/schema/src/session-event.ts:142` | `MessageContentUpdated` | Replay-only; older releases allowed replacing completed assistant content. |
| `packages/core/src/session/sql.ts:100` | `SessionPendingTable` | Legacy inbox table (`session_pending`), kept for migration. Use `SessionInboxTable`. |
| `packages/core/src/session/sql.ts:39-43` | `share_url`, `summary_*` columns | Legacy session summary/share columns. |
| `packages/core/src/session/sql.ts:51` | `revert` typed `Session.Revert | RevertV1` | Tolerates the V1 revert shape on decode. |
| `packages/core/src/session/sql.ts:43` | `FileDiff.LegacyInfo[]` | Legacy diff payload for old summaries. |
| `packages/core/src/session/provider-context.ts:60` | `upgradeLegacyMedia` | Upgrades pre-2.0.15 checkpoint media on read. |
| `packages/core/src/session/compaction.ts:166` | legacy rewrite paragraph | Not dead code: a one-time rewrite path for pre-#48058 checkpoints. Do not remove until no live session predates it. |
| `packages/core/src/session/execution.ts:185` | `noopLayer` | "Low-level compatibility layer for callers that only need durable Session recording." Not the real execution path. |
| `packages/core/src/snapshot.ts:225` | `noopLayer` | Snapshot-disabled placeholder, not a real capture. |

A quick rule: if a module imports from `packages/schema/src/v1` or
`packages/core/src/v1`, it is migration or replay code. If you are tracing the live agent
path, stop and follow the current module instead.
