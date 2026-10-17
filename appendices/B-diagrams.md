# Appendix B — Diagram atlas

This appendix is an index and a read-aloud script, not a second copy of the art. The
canonical source of every diagram lives inline in its part, in the topic that owns it, as a
Mermaid block, an ASCII fallback, and a narration. Editing the picture here would let two
versions drift, and the inline one would be the one readers trust. So this file records each
diagram once, points at where it lives, and carries an audio-ready narration that can be read
on its own. If a diagram and this table ever disagree, the part wins.

Ids are global and stable across the series, `D1` through `D52`. Nothing here is drawn; to
see the Mermaid or the ASCII, follow the home.

---

## Registry

| Id | Title | Home (file, topic) | Type | What changes along the edges |
|---|---|---|---|---|
| D1 | Layering and module dependencies | 00-orientation.md · § 0.2 The architecture map | flowchart | Dependency direction only: schema feeds ai, core, protocol; ai feeds core; protocol and core feed server. Each arrow is a compile-time dependency on a contract. |
| D2 | End-to-end request lifecycle | 03-the-agent-loop.md · § 3.1 drain, advanceToStep, runStep, attempt | flowchart | Admission → wake and claim → advance → step → one model call → tool fiber → bus → projection → client; continuation loops back to advance; idle releases the claim. |
| D3 | Durable event → projection → read model | 02-durable-state.md · § 2.2 Bus → projector → SQLite (re-viewed in 03 § 3.5) | flowchart | Publish → lock aggregate → advance sequence → run projectors → optional raw row → commit → notify subscribers. Read models change inside the transaction. |
| D4 | Inbox delivery state machine | 02-durable-state.md · § 2.3 The inbox (re-viewed in 11 § 11.2) | stateDiagram | Enqueued enters admitted; a delivery change flips steer and queue; cancel leads to gone; delivery deletes the row and inserts the message. |
| D5 | Run coordinator: execution, doorbell, interrupt | 09-concurrency-sessions.md · § 9.2 The run coordinator | stateDiagram | Wake or run starts an execution; a doorbell rung mid-drain re-drains; a drain end goes idle or starts a successor; interrupt moves into settling. |
| D6 | Step internals: stream, tool fibers, settlement | 03-the-agent-loop.md · § 3.3 Parallel tool fibers | flowchart | Provider event → uninterruptible publish; tool-call → fork a fiber; the run settles success or failure uninterruptibly; unsettled fibers are swept into an outcome. |
| D7 | Tool-call lifecycle | 05-tools.md · § 5.1 The tool contract and registration | stateDiagram | Advertised → requested → repaired → validated → executing → normalized → bounded → settled, with invalid input, missing name, or tool error branching to failed or unavailable first. |
| D8 | Context assembly pipeline | 04-context-assembly.md · § 4.1 select vs load | flowchart | Selection → load → transcript → plugin hook → normalized request. Each edge adds or transforms frozen data. |
| D9 | Compaction decision and shrink loop | 07-compaction.md · § 7.1 Why and when | flowchart | A not-due short circuit stops before the estimate; measured plus estimated crossing the ceiling selects compact. |
| D10 | Retry, continue, recover-full decision tree | 03-the-agent-loop.md · § 3.2 One step, one LLM call (re-viewed in 08 § 8.2) | flowchart | End-of-attempt conditions map to branches: overflow to compacted, transport to recover-full, retryable to retry or continue, length to output-limit, otherwise completed. |
| D11 | Subagent lifecycle and its job | 09-concurrency-sessions.md · § 9.4 Subagents | stateDiagram | Created → running; foreground blocks, background returns; terminal success, failure, or cancel leads to notification, then a synthetic message into the parent. |
| D12 | Permission evaluation and the defect tunnel | 06-permissions-hitl.md · § 6.1 Rulesets and precedence | flowchart | A configured denial blocks as a typed error; per-resource evaluation yields allow, deny, or ask; ask defers to a human; a plain reject tunnels out as a defect, a reject with a message returns typed. |
| D13 | Token and context budget | 01-model-boundary.md · § 1.3 Output-token budgeting (re-viewed in 07 § 7.1) | flowchart | Catalog limits and prompt measurement produce the room, which becomes the output limit and then the request's max tokens. |
| D14 | Instruction hash and delta flow | 04-context-assembly.md · § 4.3 Instruction sources | flowchart | Read → hash → diff against current; unchanged skips, changed emits a delta and a blob → publish → project. The baseline is rendered from the epoch each request. |
| D15 | Snapshot, diff, and revert lifecycle | 10-snapshots-changes.md · § 10.1 Snapshots | flowchart | Capture start → step → capture end; the pair produces the changed-path list and per-file diffs; revert restores, commit truncates. |
| D16 | What a coding agent is | 00-orientation.md · § 0.1 What a coding agent actually is | flowchart | Input → step → model events; a tool call passes the permission gate, runs in a fiber, touches the filesystem, and records durably; stop resolves continuation from the record into the next step or idle. |
| D17 | The canonical model boundary | 01-model-boundary.md · § 1.1 Canonical request/response | flowchart | Input → canonical request → provider body → frames → canonical events → response. |
| D18 | One streamed model call inside a step | 01-model-boundary.md · § 1.2 Streaming events and finish reasons | sequence | Client, bus, runner, step, and provider exchange admissions, deltas, a parsed tool call, a gated tool run, durable results, and a continuation. |
| D19 | Provider-scoped replay | 01-model-boundary.md · § 1.4 What leaks into agent correctness | flowchart | Same model replays call-side metadata; a different model downgrades reasoning to text and drops proof; hosted payloads replay only within the same provider; all paths reach the request. |
| D20 | Session history as an ordered, typed log | 02-durable-state.md · § 2.1 Sessions, ordered history, message types | flowchart | Event → projector → message row keyed by session and sequence; the row type splits conversation, markers, and the terminal; reads order by sequence. |
| D21 | Write-ahead claim and terminal lifecycle | 02-durable-state.md · § 2.4 The write-ahead execution claim | stateDiagram | Idle → claimed on started; a terminal releases to idle; shutdown keeps the claim; a crash orphans it; boot resumes with a bumped attempt count or fails when the budget is gone. |
| D22 | Replay and read-model materialization | 02-durable-state.md · § 2.5 Replay and read models | flowchart | Ordered rows → latest compaction boundary → a cut at the first unsettled assistant for preview; usage records fold into counters and a stats window. |
| D23 | System-prompt part assembly | 04-context-assembly.md · § 4.2 System-prompt assembly | flowchart | Tool definitions select guidance lines; the base prompt plus guidance becomes the first part; the frozen baseline is the second; ordering is fixed for cache stability. |
| D24 | Instruction discovery and injection | 04-context-assembly.md · § 4.4 Discovery | flowchart | Four discovery routes plus the read tool converge on one instruction source; a change or a new read emits a synthetic injection recorded in metadata. |
| D25 | Skill catalog and on-demand load | 04-context-assembly.md · § 4.5 Skills | flowchart | List → filtered and sorted catalog → prompt; a tool call passes permission, prepares the body and file listing, and returns a tool result. |
| D26 | MCP instruction block and tool source | 04-context-assembly.md · § 4.6 MCP | flowchart | Instructions and tools → reachability filter → instruction block and namespaced registry tools → snapshot. |
| D27 | Lowering decision state machine | 04-context-assembly.md · § 4.7 Lowering | stateDiagram | Message type selects a branch; assistant splits on same-model versus cross-model; every branch passes through unsupported-part and image normalization to provider messages. |
| D28 | Agent selection and default resolution | 04-context-assembly.md · § 4.8 Agents | flowchart | An id short-circuits; otherwise default, then build, then first selectable; the chosen agent merges permissions, narrows instructions and tools, and sets the step limit. |
| D29 | Snapshot assembly | 05-tools.md · § 5.2 The snapshot | flowchart | Registry → denied filter → code-mode split → definitions (direct or one execute) → provider; the registry also yields a captured executor closure keyed to the call. |
| D30 | Input validation and repair | 05-tools.md · § 5.3 Runtime validation | flowchart | Repair → decode; a valid call runs, an invalid one returns a structured error; output encoding succeeds or reports a declared-output error. |
| D31 | Output normalization and bounding | 05-tools.md · § 5.4 Output normalization | flowchart | Result → content fold → image normalization → size check → native result or a bounded head with a marker and output path. |
| D32 | The built-in toolkit | 05-tools.md · § 5.5 The built-in toolkit as prompt design | flowchart | Discovery tools feed mutation tools; shell and external tools sit alongside. Descriptions route the model to the right family. |
| D33 | Shell lifecycle, foreground and background | 05-tools.md · § 5.6 The dangerous tools | stateDiagram | Preparing → rejected or running; running → completed, timed out, or backgrounded; a background job settles into a synthetic notification; every result is bounded. |
| D34 | CodeMode: tools in, program out | 05-tools.md · § 5.7 CodeMode | flowchart | Code-mode split → inventory → summarized catalog into an instruction source; inventory → runtime → one execute definition; returned code → interpreter → leaf or web → structured output. |
| D35 | Plugin tool sources and hooks | 05-tools.md · § 5.8 Plugins as tool sources | flowchart | Plugin → transform → registry → snapshot → call; the before hook rewrites or rejects input; the after hook rewrites the normalized result; MCP reloads without reordering. |
| D36 | Permission reply lifecycle | 06-permissions-hitl.md · § 6.2 ask, allow, deny | sequence | Assert → ask → deferred → reply; a plain reject tunnels to the step, a reject with a message becomes a tool result, and once or always proceeds. |
| D37 | Batch reply propagation | 06-permissions-hitl.md · § 6.3 Batch semantics | flowchart | Once resolves one request; always saves then re-evaluates siblings; reject fails every same-session pending request with the same error. |
| D38 | Question tool lifecycle | 06-permissions-hitl.md · § 6.4 The question tool and forms | stateDiagram | Pending → permissioned → created; answered becomes model text; a dismissal without a message dies into the tunnel, with a message becomes feedback; an interrupt cancels. |
| D39 | Delivery and shrink loop | 07-compaction.md · § 7.2 Triggers and the shrink loop | flowchart | Fits → send; too long → retarget to a shrinking fraction; payload too large → resend as text; another error → the retry policy; three failed shrinks → fail. |
| D40 | Summary build and keep-recent split | 07-compaction.md · § 7.3 Summarisation | flowchart | Split into older and recent; older is summarized; a template mismatch triggers one nudge, a second miss fails; the result is persisted and rendered as a checkpoint. |
| D41 | Native checkpoint provenance and replay | 07-compaction.md · § 7.4 Native and provider compaction | flowchart | Native → provenance checked before and after hooks; compatible → in-band or endpoint compaction → versioned provider context; later replay only when provenance matches. |
| D42 | Output-limit fitting and the cache effect | 07-compaction.md · § 7.5 Output-limit fitting | flowchart | Catalog limit → output limit → request max tokens → fitOutput lowers it to the real request; a front rewrite causes a cache miss while the tail stays cacheable. |
| D43 | Retry backoff schedule | 08-reliability.md · § 8.1 Retry policy | flowchart | Retryable → a gap (retry-after or jittered backoff) → schedule limits → RetryScheduled and sleep → next attempt; non-retryable or exhausted → stop. |
| D44 | Wire failure to persisted error | 08-reliability.md · § 8.3 Error taxonomy | flowchart | Wire failure → classified reason → both the retry decision and a normalized persisted error; content-filter and unknown finish reasons branch through normalization. |
| D45 | A turn's claim across a crash | 08-reliability.md · § 8.4 Stale settlement after a crash | stateDiagram | Started writes the claim; a terminal releases it; a crash orphans it; boot sweeps stale work, resumes with a budget, or fails when the budget is spent. |
| D46 | Global services and the instance map | 09-concurrency-sessions.md · § 9.1 Location scoping and affinity | flowchart | Global services → location map keyed by canonical path → per-directory instance; provisioning routes a session; an affinity key routes the provider cache. |
| D47 | Promotion ordering and the move boundary | 09-concurrency-sessions.md · § 9.3 Steering | flowchart | Steers promote up to the first control; a front control blocks; compaction moves ahead of steers; one queued item promotes at idle; a move is an uncrossable boundary. |
| D48 | Multiple sessions and a narrow interrupt | 09-concurrency-sessions.md · § 9.5 Multi-session concurrency | flowchart | Coordinator keyed by session → concurrent executions each routed to their instance; interrupt names one key and settles later; resume with a pending steer starts a successor. |
| D49 | One step's snapshot pair and file list | 10-snapshots-changes.md · § 10.2 Diffs and per-step files | flowchart | Start and end equal → an empty file list; they differ → changed paths onto the message; diff on demand recomputes per-file patches. |
| D50 | Revert: stage, clear, commit | 10-snapshots-changes.md · § 10.3 Revert | stateDiagram | Clean → staged → clean on clear, or truncated on commit; staging again moves the boundary while keeping the original. |
| D51 | Event fan-out from one bus | 11-observability-api.md · § 11.1 Bus → server → live stream | flowchart | Publish → projectors in the transaction and listeners after commit; listeners feed SSE clients; the durable log replays for a reconnecting client. |
| D52 | Durable facts versus streamed hints | 11-observability-api.md · § 11.3 What to persist vs stream | flowchart | Non-derivable events persist with an envelope and version and drive projectors and replay; derivable events stream best-effort to the interface. |
| D53 | The milestone dependency ladder | 12-build-it-yourself.md · § 12.1 The milestone roadmap | flowchart | Each milestone adds one invariant to the one below; later milestones never rewrite earlier ones, so the ladder is a dependency chain rather than a checklist. |
| D54 | Symptoms map to layers, and the layer names the fix | 12-build-it-yourself.md · § 12.2 The pitfall catalog | flowchart | An observed symptom (dashed) points at a layer whose rule (solid) is the fix; the same symptom can be produced by two layers, so the diagram forces you to name the layer before the patch. |
| D55 | D2's terminal-step path | 03-the-agent-loop.md · § 3.4 Step limits and the terminal step | stateDiagram | The step counter advances while steps remain; on the terminal step the tool definitions stay for cache stability but the tool choice becomes none, so the only legal transition is a text answer. |

Referenced but not drawn here: none. Every diagram id that a part cites is drawn in its home
topic.

---

## Narration

The read-aloud text for each diagram. It is pulled from the owning part and edited so it
stands alone on audio: no pointing at the page, no code, no asides.

### D1 — Layering and module dependencies

Picture five layers stacked so that every arrow points toward the contracts. At the bottom is
the schema layer, which owns the wire and storage shapes and depends on almost nothing. Beside
the runtime sits the model layer, which turns a canonical request into a provider call and
depends only on the contracts. The runtime builds the agent on top of both: sessions, the
runner, the bus, tools, and permissions. The protocol layer describes the HTTP surface over
the contracts. The server stitches the runtime and the protocol together. Because no contract
needs to know about an implementation, the layers cannot collapse into one another.

Source: 00-orientation.md § 0.2 The architecture map.

### D2 — End-to-end request lifecycle

A client prompt is admitted to a durable queue called the inbox, which wakes one execution
task. That task repeatedly advances to the next step, promoting pending input and loading
context from the database, and then runs a step, which makes exactly one model call and forks
a separate task for each local tool call. Tool results and model output go to the bus, are
folded into message rows, and are streamed to the client. When a step says more work is
needed, the task loops back to advance again. When no work is left, it goes idle and releases
its claim.

Source: 03-the-agent-loop.md § 3.1 drain, advanceToStep, runStep, attempt.

### D3 — Durable event → projection → read model

A caller publishes an event. The bus takes a lock for that aggregate, opens one database
transaction, computes the next sequence number, runs every projector registered for that event
type inside the transaction, runs any local commit hook, and advances the stored sequence.
Only after the commit does it notify live subscribers. Because the read models and the
sequence advance happen in the same transaction, no reader can ever observe a half-written
event next to a sequence number that has already moved.

Source: 02-durable-state.md § 2.2 Bus → projector → SQLite.

Re-view in Part 3 § 3.5. The publisher maps each model event to a durable event and publishes
it in a way that cannot be interrupted. The bus projectors fold those events into message and
usage rows in the same transaction. Those rows are what the next step reloads as its context
and what clients read. The publisher never writes the read model directly; it only states
facts and lets the projection do the writing.

Source: 03-the-agent-loop.md § 3.5 The publisher and its concurrency invariants.

### D4 — Inbox delivery state machine

A row appears when work is admitted and lives with a delivery mode of steer or queue. Between
admission and delivery the mode can be flipped in either direction, or the row can be
cancelled and disappear. When the runner promotes the row, delivery deletes it and inserts the
visible message in the same transaction. The table is pending-only, so it holds nothing that
has already been shown; the queue is short by construction.

Source: 02-durable-state.md § 2.3 The inbox.

Re-view in Part 11 § 11.2. A client's input enters a pending queue. Choosing steer or queue
only changes how and when that row promotes: a steer promotes at the next step boundary, and a
queued item waits until the session would otherwise go idle. Cancelling removes a pending row;
promoting turns it into a visible message. The reply paths for permissions and forms are a
different shape, because they resolve a waiter rather than enqueue a row, but the idea is the
same: the client writes an intent and progress comes back as events.

Source: 11-observability-api.md § 11.2 Driving the agent.

### D5 — Run coordinator: execution, doorbell, interrupt

A key starts idle. A wake or a run starts one execution task. Inside that execution a drain
runs, and if work arrives while it is running, a doorbell rings and the loop drains again
instead of ending. When the drain finally ends, the doorbell decides what happens next: if it
is quiet the key goes idle and any waiters receive this execution's exit, and if it rang, a
successor execution starts while the waiters still receive this exit. An interrupt moves a
running execution into settling, where the same quiet-or-sound rule applies.

Source: 09-concurrency-sessions.md § 9.2 The run coordinator.

### D6 — Step internals: stream, tool fibers, settlement

One attempt reads the model's stream. Each event is published without interruption. A tool
call is published to the bus first, and only after that does the step fork a task to run it.
The task runs the tool interruptibly and then settles its result uninterruptibly, whether that
result is success or failure. When the stream ends or is interrupted, the step waits for every
tool task, sweeps any that never settled, classifies how they exited, and returns an outcome.
Per-source order is safe because each task is sequential, and no global order is needed
because consumers fold results by identifier.

Source: 03-the-agent-loop.md § 3.3 Parallel tool fibers.

### D7 — Tool-call lifecycle

A tool call begins as a definition the model was shown and becomes a tool-call event. Before
anything runs, hooks may rewrite the arguments; then the input is decoded against the tool's
schema, which is the one place a malformed call becomes a model-readable failure rather than a
crash. A valid call runs the leaf, which does its own permission check and side effects, and
its result is normalized into content and images, then bounded to disk if it is too large.
Success and failure both end in a settlement event, because the only thing that makes a step
resumable is a recorded outcome.

Source: 05-tools.md § 5.1 The tool contract and registration.

### D8 — Context assembly pipeline

A session identifier goes in. Selection resolves who is asking: the session, the agent, the
list of instruction sources, and a frozen snapshot of the tools, and hands that forward.
Loading then resolves the model and reads the active history, producing the frozen instruction
baseline plus the live messages. That loaded bundle is lowered into provider messages, passed
through a plugin hook that may rewrite the draft, and finally normalized for the specific
model, replacing unsupported parts and bounding oversized images, before the request goes to
the provider.

Source: 04-context-assembly.md § 4.1 select vs load.

### D9 — Compaction decision and shrink loop

Before compacting automatically, the agent checks two things. First, that it is not standing
immediately after a compaction. Second, that it has a trustworthy measurement: a token count
from the same provider, taken after any native checkpoint. Only then does it compare its
estimate of the prompt with the ceiling and compact when that estimate has reached the
ceiling. Either precondition failing means the agent does not compact, because acting on an
unmeasurable window would risk throwing away context it cannot recover.

Source: 07-compaction.md § 7.1 Why and when.

### D10 — Retry, continue, recover-full decision tree

When a single model call ends, the runner walks a decision tree. If the request was too long
before any output was produced, it compacts and retries. A connection failure needing full
recovery disables continuation recovery and retries. A retryable failure with no output yet
retries the same step; once output has started, it continues instead with a synthetic nudge. A
model that ran out of output tokens is nudged to continue, bounded by a streak check.
Otherwise the step is complete, and whether to run another step is decided solely by whether
the model made a local tool call.

Source: 03-the-agent-loop.md § 3.2 One step, one LLM call.

Re-view in Part 8 § 8.2. The recovery choice pivots on whether the attempt produced visible
output. Before any output, a full-recovery transport failure discards and re-issues the whole
request once; otherwise a retryable failure is retried transparently against the same
assistant message, and anything else fails visibly. After output has begun, the partial answer
is kept: an interrupted or retryable stream becomes a continuation with a synthetic prompt and
a fresh assistant message, while a non-retryable failure is surfaced. Both retry and continue
publish a scheduled-retry event so the client can count down.

Source: 08-reliability.md § 8.2 retry vs continue vs recover-full.

### D11 — Subagent lifecycle and its job

A parent tool call first measures how deep the conversation already nests and refuses if the
depth limit is reached. It then checks permission for the chosen agent, resolves the child's
model by inheritance, and creates or continues the child session. It starts a job. In
background mode the parent returns immediately, and an observer notifies it when the child
finishes. In foreground mode the parent blocks on the job, which races completion against
being backgrounded. On completion, the child's outcome is admitted into the parent as a
synthetic message.

Source: 09-concurrency-sessions.md § 9.4 Subagents.

### D12 — Permission evaluation and the defect tunnel

Evaluation folds an ordered rule list twice. First the configured rules, which are the agent's
rules and the session's rules together, are checked only for outright denials, which
short-circuit. Then the full list, configured rules plus the project's saved always-grants, is
evaluated per resource with last-match-wins. If any resource wants a human, the request is
registered and we wait. A human no without feedback is not returned as a value: it is thrown
as a defect that flies past every error handler and is caught, deliberately and by type, only
at the boundary where tool results are produced.

Source: 06-permissions-hitl.md § 6.1 Rulesets, wildcard precedence, merge, saved rules.

### D13 — Token and context budget

The window is a fixed size. The prompt takes part of it. The measured part is what the
provider actually counted at the last response, and the estimated part is the text since, plus
a margin. Whatever remains is the room for the reply, and that room, capped by the model's own
output limit, becomes the maximum output the request asks for. Measuring rather than guessing
is what keeps input and output inside the window instead of overflowing it.

Source: 01-model-boundary.md § 1.3 Output-token budgeting.

Re-view in Part 7 § 7.1. The prompt's size is the provider's own number for everything it has
already seen, plus a rough character count for what arrived since. That sum is compared with a
ceiling, which is the window minus a reserve large enough to allow a real reply. When the
window is unknown, nothing triggers automatically, but the compaction request still aims at a
common window size so it produces something usable. A just-completed compaction suppresses the
next one until the runner has rebuilt the request from it.

Source: 07-compaction.md § 7.1 Why and when.

### D14 — Instruction hash and delta flow

Each source is read and its value hashed. The hash is compared to what was stored. Unchanged
sources vanish; changed sources produce a delta entry and a blob. The blob is written once,
and the delta and its frozen text are published together. At request time the baseline is
rendered from the epoch's initial values, while the update text already sits in history.
Storing hashes instead of whole values is what lets the agent tell the model what changed
without restating the baseline every request.

Source: 04-context-assembly.md § 4.3 Instruction sources.

### D15 — Snapshot, diff, and revert lifecycle

Every step takes a fingerprint of the whole working tree before the model is called and again
after it has finished, and stores both fingerprints on the step. The fingerprints are content
hashes, so comparing them is cheap and exact. The difference between them is the list of files
the step changed, and the filesystem diff between them is the patch. Undoing a step means
restoring the files from the earlier fingerprint. Nothing in this loop consults the model: the
record of what changed is derived from the disk.

Source: 10-snapshots-changes.md § 10.1 Snapshots.

### D16 — What a coding agent is

The picture starts with input that has already been written down, and a step is a single call
to the model. The model streams back events. If it asks for a local tool, the request goes
through a permission gate and, if allowed, the tool runs in its own task and its result is
written down before the loop looks again. If the model stops, the decision to continue is made
from what was recorded, not from an in-memory variable. Every arrow that could be lost in a
crash terminates in durable storage.

Source: 00-orientation.md § 0.1 What a coding agent actually is.

### D17 — The canonical model boundary

An ergonomic input is normalized into one canonical request. A route turns that request into
the provider's own body and checks it against a schema before sending. Bytes come back, get
cut into frames, decode into canonical events, and fold into a response. The loop only ever
sees the canonical request and the canonical events; the provider's shape exists only inside
the route.

Source: 01-model-boundary.md § 1.1 Canonical request/response.

### D18 — One streamed model call inside a step

A client admits work to the bus, and the runner promotes it. The step makes one model call and
receives a stream of deltas that ends in a parsed tool call and a finish event. A local tool
runs in a task, gated by permission, and its result plus the step's end are written durably
and streamed to the client. The runner decides from the record whether to run another step.

Source: 01-model-boundary.md § 1.2 Streaming events and finish reasons.

### D19 — Provider-scoped replay

For each piece of assistant content, lowering asks whether the current model is the one that
produced it. If it is, the call-side metadata is replayed. If it is not, readable reasoning is
kept as text, and a hosted tool's result payload is replayed only when the provider still
matches; a different provider gets none of it. Everything ends in the same canonical request.

Source: 01-model-boundary.md § 1.4 What leaks into agent correctness.

### D20 — Session history as an ordered, typed log

Every event that concerns a session is folded by a projector into one row of the message
table, keyed by the session and stamped with a monotonic sequence number. The row's type
decides whether it is conversation, injected context, a side effect, a control marker, or the
idle terminal. Reading history means selecting rows for the session ordered by that sequence
number, never by wall-clock time. The sequence number is what gives a session a total order
even when two facts share a timestamp.

Source: 02-durable-state.md § 2.1 Sessions, ordered history, and message types.

### D21 — Write-ahead claim and terminal lifecycle

A turn begins by writing its claim together with the started event. A normal terminal, whether
success, failure, or a user interrupt, releases the claim in the same transaction and returns
the session to idle. A graceful shutdown keeps the claim on purpose, so the resumed execution
continues the same turn. A crash leaves the claim set with no terminal: that is the crash
record. On the next boot, recovery finds the orphaned claims, durably counts an attempt before
each resume, and either resumes the turn or, once the budget is exhausted, emits a terminal
failure that releases the claim for good.

Source: 02-durable-state.md § 2.4 The write-ahead execution claim.

### D22 — Replay and read-model materialization

The transcript is read from the message table in sequence order, starting at the latest
completed compaction boundary if there is one. A preview truncates at the first assistant
message that has not settled, so a client never renders an unresolved tool call as final.
Separately, durable usage records are folded into the session's token and cost counters, and
the stats read model aggregates those counters and the durable usage events over a time
window. All of it comes from recorded data, never from a live provider.

Source: 02-durable-state.md § 2.5 Replay and read models.

### D23 — System-prompt part assembly

The tool definitions decide which guidance lines exist. Those lines are spliced into the base
prompt at a placeholder, producing the first system part; the frozen instruction baseline
becomes the second. The order of the parts, and the order of the guidance lines inside the
first, is fixed, so the same inputs yield byte-identical output and the provider's prefix
cache keeps hitting. Conditional guidance is what lets one prompt serve many tool sets without
fragmenting the cache.

Source: 04-context-assembly.md § 4.2 System-prompt assembly.

### D24 — Instruction discovery and injection

Global, project, configured, and remote files all land in one in-memory map and become a
single instruction source that changes when files change. The read tool is a fifth route: when
it reads under the project it walks up for nearby agent instruction files and injects any it
has not injected in this session, recording the paths in message metadata so it does not
repeat them. Discovery is continuous, so a file edited mid-session is picked up without the
user pasting anything.

Source: 04-context-assembly.md § 4.4 Discovery.

### D25 — Skill catalog and on-demand load

The skill service lists skills, and the catalog keeps only the ones the model may use and that
are worth advertising, sorted by identifier. That catalog is the entire system-prompt
footprint: names and descriptions, nothing more. When the model calls the skill tool, a
permission is checked, and the full body is read and wrapped with its base directory and a
small file listing, then returned as a tool result. The body enters the conversation only when
a task actually needs it.

Source: 04-context-assembly.md § 4.5 Skills.

### D26 — MCP instruction block and tool source

The MCP service supplies both server instructions and server tools. For each server, a
permission check decides whether its instruction block is visible: a code-mode server needs
the ability to run the execute tool, and a native server needs at least one allowed tool.
Visible blocks go into the instruction source; the tools themselves go through the MCP tool
transform into the registry and, from there, into the tool snapshot that the request is built
from.

Source: 04-context-assembly.md § 4.6 MCP.

### D27 — Lowering decision state machine

A session message enters, and idle or agent-switched messages fall away with no output. An
assistant message is the hard case: if the target model is the same one that produced it and
there was no error, its metadata is kept verbatim. Otherwise reasoning becomes text where it
can be read, call-side proof is dropped, and only hosted-tool result payloads survive within
the same provider. Everything then passes through two model-aware normalizations, replacing
unsupported media and bounding oversized images, before the request is sent.

Source: 04-context-assembly.md § 4.7 Lowering.

### D28 — Agent selection and default resolution

Selection either takes an explicit identifier, which resolves directly, or resolves the
default by trying the configured default, then the build agent, then the first selectable
agent, skipping subagents and hidden agents at every step. The chosen agent's permissions
merge with the session's and narrow everything selection assembles. Its step limit bounds the
execution and forces a tool-free summary at the limit.

Source: 04-context-assembly.md § 4.8 Agents.

### D29 — Snapshot assembly

The snapshot is the seam between the mutable registry and the immutable request. Permission
rules first remove tools that are denied outright. The survivors are split: tools that opt out
of code mode become direct provider definitions, and the rest go into a code-mode inventory
that renders a catalog and a single execute definition. The definitions go to the provider,
while the executor closure stays behind, ready to resolve whatever name comes back against the
very tools that were advertised.

Source: 05-tools.md § 5.2 The snapshot.

### D30 — Input validation and repair

The model's arguments first pass through a conservative repair pass that fixes exactly the
mistakes the schema proves are type errors, then through the schema decode. A failure becomes
a structured message naming the field, showing the JSON the model sent, and telling it to try
again. On the way out, a tool's declared output is checked too, because a tool that returns
the wrong shape is a bug the model should not inherit.

Source: 05-tools.md § 5.3 Runtime validation.

### D31 — Output normalization and bounding

A result is first folded into content the model can read. File parts that are images are
resized or, if that fails, replaced by a note saying the image was omitted. Then the text is
measured. If it is over budget, the whole thing is written to a managed file and the model
gets the head plus a marker naming that file. The marker and the truncation metadata are what
turn a silent loss of information into a recoverable one.

Source: 05-tools.md § 5.4 Output normalization.

### D32 — The built-in toolkit

The toolkit is four families. Discovery tools find files and content. Mutation tools change
them: one for surgical edits, one for whole files, and one for multi-file changes on models
that do better with a single envelope. The shell tool is the escape hatch that runs anything,
and the fetch and search tools reach outside the repository. The descriptions are what keep
the model in the intended family: they teach the numbered-line format, the exact-match
contract of the edit tool, and when to prefer a dedicated tool over the shell.

Source: 05-tools.md § 5.5 The built-in toolkit as prompt design.

### D33 — Shell lifecycle, foreground and background

A shell command is prepared, with its working directory resolved and its permission checked,
then started as a job. A foreground command either completes, times out with a message, or is
promoted to the background. A background command returns immediately with a shell identifier
and a promise of notification; when the job settles, the session receives a synthetic message
carrying the output. In every path the result is bounded before it reaches the model, so a
runaway command cannot flood the context.

Source: 05-tools.md § 5.6 The dangerous tools.

### D34 — CodeMode: tools in, program out

Tools split into two pools. Those that opt out stay as native provider tools; the rest go into
a code-mode inventory. The inventory is summarized under a token budget into a catalog, which
becomes an instruction source that updates by delta. The same inventory backs a confined
runtime exposed to the model as one execute tool. When the model sends code, the interpreter
runs it, dispatching each tool call to the real leaf and letting fetch reach the network, then
returns a structured output with the value, the calls it made, and any files.

Source: 05-tools.md § 5.7 CodeMode.

### D35 — Plugin tool sources and hooks

A plugin registers tools through the same transform the built-ins use, so after registration
its tools are indistinguishable from any other. It observes calls through two hooks. The
before hook can rewrite the arguments or reject the call outright. The after hook runs once
the tool has finished and can rewrite the result. MCP is the notable dynamic source: it keeps
one transform that reads the newest tool list and reloads, so a refresh never reorders a
plugin that registered after it.

Source: 05-tools.md § 5.8 Plugins as tool sources.

### D36 — Permission reply lifecycle

A tool suspends on a deferred promise while a client is asked. If the human rejects plainly,
the promise is failed, but the awaiting code immediately converts that failure into a defect,
so it passes untouched through every tool's error wrapper and is recovered, typed, only at the
single boundary that produces tool results. The step then treats it as an interruption. If the
human rejects with a message, the failure is left alone, the tool wrapper turns it into an
ordinary tool failure, and the model reads the feedback and keeps working.

Source: 06-permissions-hitl.md § 6.2 ask, allow, deny.

### D37 — Batch reply propagation

A batch reply fans out only to the same session's pending requests. A rejection rejects them
all with the same error, closing every prompt at once. An always answer is different: it
writes the grant first and then re-checks each sibling against the new rules, dispensing only
the ones the rule now covers and leaving the rest for the human to decide. That way one
decision cannot silently approve a request the human never saw.

Source: 06-permissions-hitl.md § 6.3 Batch semantics.

### D38 — Question tool lifecycle

The tool first clears its own permission gate, then opens a form whose fields are the
questions. The form stays pending until a human answers it, cancels it, or the step is
interrupted, in which case the form is cancelled automatically. An answer becomes model text.
A plain dismissal is thrown as a defect that only the shared boundary recovers, which ends the
step. A dismissal carrying a message is ordinary feedback that the model reads and acts on.

Source: 06-permissions-hitl.md § 6.4 The question tool and forms.

### D39 — Delivery and shrink loop

The loop sends a request only once it believes it fits. A provider rejection as too long makes
it reset its target to a shrinking fraction of the first rejected request's size. A
payload-too-large rejection makes it resend the same content as plain text, which strips the
inline media that caused the byte count. Any other error is retried under the session policy.
After three failed shrinks it gives up and records a compaction failure.

Source: 07-compaction.md § 7.2 Triggers and the shrink loop.

### D40 — Summary build and keep-recent split

The oldest part of the conversation becomes a prompt asking for a fixed-sections summary,
while the newest messages are kept as text alongside it. If the reply does not use the
required headings, the agent sends exactly one reminder; a second miss is a failure. The saved
checkpoint is replayed into future requests inside wrapper tags that mark it as history, so
later requests see a summary and a verbatim recent window instead of the whole transcript.

Source: 07-compaction.md § 7.3 Summarisation.

### D41 — Native checkpoint provenance and replay

Before using the provider's own compaction, the agent must derive a stable identity for the
endpoint; if it cannot, it refuses. It then re-checks that identity after any request hooks
have run, so a hook cannot silently reroute an opaque checkpoint to another deployment. The
resulting checkpoint carries that identity and its messages. Later it is replayed only when
the identity still matches; otherwise it is skipped and history falls back to the transcript
the checkpoint replaced.

Source: 07-compaction.md § 7.4 Native and provider compaction.

### D42 — Output-limit fitting and the cache effect

The summary's output allowance is the catalog's limit, capped, then reduced by whatever room
the input leaves in the window. Before each actual send the allowance is lowered once more to
match the request really being sent, so the input and the requested output fit together.
Compaction necessarily invalidates the provider's cache from the point where it rewrites the
front of the conversation, but keeping the checkpoint to a single front message preserves the
cache for everything after the newest exchange.

Source: 07-compaction.md § 7.5 Output-limit fitting.

### D43 — Retry backoff schedule

A failed attempt enters a decision tree. Most transient failures take a jittered exponential
gap that doubles from two seconds up to a ten-second ceiling. A rate-limit or
provider-internal failure that carries a retry-after value instead waits at least that long,
but never more than fifteen minutes. Either way the schedule stops after ten retries, or
earlier if the failure is a timeout that has already used its three-retry budget, because a
timeout has already spent its wall-clock time once.

Source: 08-reliability.md § 8.1 Retry policy.

### D44 — Wire failure to persisted error

A raw provider failure is classified once, from all the evidence on the wire, into one typed
reason. That reason feeds two consumers. The retry decision asks whether the reason is
retryable, and normalization maps the reason to the single persisted error shape that the
user and the message store see. Two finish reasons bypass the wire entirely: a content-filter
finish becomes a content-filter error, and an unknown finish becomes a synthetic
incomplete-stream failure so it cannot masquerade as success.

Source: 08-reliability.md § 8.3 Error taxonomy.

### D45 — A turn's claim across a crash

The start of an execution writes a claim alongside its started event, and a terminal writes
the release. If the process dies anywhere in between, the claim survives with no terminal, a
durable fingerprint of a dead process. On the next boot, the first drain settles any
compaction or tool call still marked running, then a restart sweep admits a
continue-from-where-you-left-off notice and wakes the session. A per-turn attempt budget then
decides whether the session resumes again or is finally failed.

Source: 08-reliability.md § 8.4 Stale settlement after a crash.

### D46 — Global services and the instance map

Global services are built once per process. The location-scoped graph is built once per
working directory and cached in a map keyed by the canonical path. A session's location picks
its instance, so the runner and every tool it uses are the ones for that directory.
Separately, related sessions share a provider-affinity key derived from the parent or fork, so
a subagent's requests ride the same provider cache route as its parent's.

Source: 09-concurrency-sessions.md § 9.1 Location scoping and affinity.

### D47 — Promotion ordering and the move boundary

Promotion reads the pending input in enqueue order and applies four rules. If any steers are
waiting, they go first, but a control item at the front blocks promotion so the runner can
handle it, and a compaction among steers is moved to the front so the later steers survive
verbatim. If no steers are waiting and this is an idle boundary, exactly one queued item is
promoted, followed by any steers that arrived meanwhile. A move is a hard boundary: nothing is
promoted across it, and the drain hands off to the new location.

Source: 09-concurrency-sessions.md § 9.3 Steering.

### D48 — Multiple sessions and a narrow interrupt

The coordinator is one process-global table keyed by session identifier, so three sessions are
three concurrent executions, each draining through its own location's instance. An interrupt
names one key and returns immediately whether that key was active; its cleanup and terminal
event happen later in the execution task. A user or inactivity interrupt releases the claim
and cancels jobs, while a shutdown interrupt keeps the claim for restart. If resumption is
requested and steering work is pending, a steer-scoped wake starts a successor execution for
just that work, leaving queued prompts parked.

Source: 09-concurrency-sessions.md § 9.5 Multi-session concurrency.

### D49 — One step's snapshot pair and file list

A step keeps two fingerprints and the list of paths that differ between them. The path list is
cheap and goes onto the conversation record immediately. The patch itself is not stored; it is
recomputed from the same two immutable trees whenever a client wants to see the change. That
means the summary and the patch can never drift apart, because there is only one source for
both.

Source: 10-snapshots-changes.md § 10.2 Diffs and per-step files.

### D50 — Revert: stage, clear, commit

Revert has three moves. Staging remembers the current files as the escape hatch, then rewinds
every file that later steps touched to its earliest recorded version, all while leaving the
conversation untouched. Clearing puts the escape hatch back and forgets the boundary.
Committing is the only destructive step: it drops the messages and pending input at and after
the boundary. Anything the snapshots never captured is outside the reach of all three moves.

Source: 10-snapshots-changes.md § 10.3 Revert.

### D51 — Event fan-out from one bus

One publish goes to two audiences. The projectors run inside the recording transaction and
mutate the tables the agent reads back. The listeners run after the commit and feed an
encoding step that pushes frames to any connected clients. Neither audience is the only truth:
a client that was offline takes the durable log and replays it, while a client that is online
just watches the live frames and treats the durable end events as the authoritative values.

Source: 11-observability-api.md § 11.1 Bus → server → live stream.

### D52 — Durable facts versus streamed hints

Every event is asked one question: could a reader reconstruct this by folding the durable
history? If not, it is a fact, and it is persisted with an ordering envelope and a version.
If it can be, it is a hint, and it is streamed best-effort to make the interface feel alive.
The database is what survives a reconnect and a port to another runtime; the stream is what
makes it pleasant to watch.

Source: 11-observability-api.md § 11.3 What to persist vs stream.

---

### D53 — The milestone dependency ladder

Building this agent is a ladder, not a checklist. Each rung adds exactly one guarantee, and
no rung rewrites the one below it. Start with one streamed model call and a terminal event.
Add tools and a fixed snapshot of them. Make history durable and ordered. Turn writes into
events with projections. Add the inbox, so admitting work is separate from running it. Add
permissions. Add budgeting and compaction. Add retries and crash recovery. Only then add
subagents, snapshots, and a server. Durability comes before concurrency, because concurrency
on top of state you cannot recover is only a faster way to corrupt it.

Source: 12-build-it-yourself.md § 12.1 The milestone roadmap.

---

### D54 — Symptoms map to layers, and the layer names the fix

When something goes wrong, the symptom tells you which layer to open. A duplicated answer
after a retry is a loop bug: visible output must forbid a transparent retry. A side effect
that runs twice after a crash is a durability bug: write the fact before you act. A context
overflow mid-task is a context bug: measure, estimate, and reserve. A tool result that
vanishes is a settlement bug. The dashed line is where you noticed the problem; the solid
line is where the fix lives. Name the layer before you patch the symptom.

Source: 12-build-it-yourself.md § 12.2 The pitfall catalog.

---

### D55 — D2's terminal-step path

The step counter walks toward the agent's ceiling. While steps remain, the request carries
tool definitions and the run continues on tool calls. On the final allowed step, the
definitions stay in place so the cached prefix is preserved, but the tool choice is set to
none and a maximum-steps message is appended. The model must answer in text. That one change
turns a runaway loop into a summarised stop.

Source: 03-the-agent-loop.md § 3.4 Step limits and the terminal step.

---

## Diagram conventions

Three shapes cover everything, and the choice is about what actually varies.

- **Flowchart** for pipelines and decision trees. These are the majority: data enters a
  sequence of stages, and a diamond asks a yes-or-no question that sends the flow down one
  branch. Use one when the interesting thing is *what happens next given the current value*,
  and when a single running context flows through the picture. Default is top-to-bottom for a
  process and left-to-right for a short chain.
- **State diagram** for a thing that spends time in named states. Use one when there is one
  subject whose *set of possible states* is the point, and where many different events can
  move it between the same states. Lifecycles and state machines are the whole story, so the
  nodes are states, not actions.
- **Sequence diagram** for a request and its reply across named participants. Use one only
  when the ordering of messages between parties is the point, and when a participant's
  identity matters because the same name reappears. It is the right shape for a round trip
  with a human or a provider in the loop, and the wrong shape for data that simply flows
  through a chain.

Two more rules hold across all three.

- **Edge labels name what changes.** An arrow says what became different across it, such as
  "delivery changed", "claim released", or "provenance matches". Labels like "process" or
  "handle" are banned, because they describe nothing the reader could not already see. If an
  edge cannot be labelled with the change it carries, the diagram is hiding a decision.
- **One diagram, one id, one home.** Ids are global and stable. A second view of a diagram
  keeps the same id and is marked as a re-view where it appears, so the same idea is never
  given two names.

---

## Speaker crib

For a host drawing live, the ten load-bearing pictures, each as one board instruction.

- **D2** — Draw a left-to-right conveyor: client, inbox, execution, advance, step, tool task,
  bus, projector, client, with a return arrow labelled "continuation from the record" and a
  down arrow labelled "idle releases the claim".
- **D3** — Draw a publish arrow entering a single boxed transaction; inside it write "seq++",
  "run projectors", "commit hook", then let one arrow leave the box to a bell labelled "live
  subscribers".
- **D4** — Draw one box labelled "pending", give it a two-headed arrow to a small steer-and-
  queue toggle, and two exits: one to "cancelled" and one to "delivered" that erases the box
  and writes a message.
- **D5** — Draw a circle labelled "idle", an arrow to a boxed execution that contains a small
  loop, and at its exit a diamond doorbell whose two outputs are back into the execution and
  down to idle.
- **D6** — Draw a vertical timeline: the stream at the top feeding publish, a branch at
  tool-call into a forked task, that task settling into success or failure, and a bottom bar
  labelled "await and sweep".
- **D9** — Draw three gates in a row: "not right after a compaction", "has a fresh
  same-provider measurement", "estimate reached the ceiling"; only the third gate opens onto
  "compact".
- **D10** — Draw a left-to-right decision ladder with five exits, labelled compacted,
  recover-full, retry, continue, and output-limit, and a final default exit labelled
  "completed".
- **D12** — Draw an assertion entering a two-pass rule filter that fans out to allow, deny, or
  ask; from ask, draw three human replies, and draw the plain reject as an arrow that leaps
  the whole picture to a single catch point.
- **D13** — Draw one long horizontal bar for the window, split into measured, estimated plus
  margin, and remaining room, and label the far-right segment "the reply budget".
- **D21** — Draw a small state ring: idle to claimed on start, claimed back to idle on any
  terminal, and a dotted path from a crashed claimed state through orphaned and resume, with a
  tally mark for each attempt.
