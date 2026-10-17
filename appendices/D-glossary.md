# Appendix D — Glossary

The vocabulary contract. These terms are used with these exact meanings throughout the
material. Where opencode's code uses a term, the anchor is given.

---

## The core nouns

**Session** — a durable, resumable unit of agent work: an ordered conversation plus the
state needed to continue it (agent, model, permissions, instructions). Identified by
`ses_…`. `packages/schema/src/session.ts`, `packages/core/src/session/session.ts`.

**Message** — one durable entry in a Session's history. Not the same as one model message:
a single assistant Message carries many content items, and lowering to the provider can
produce several provider messages from one. Message types: `user`, `assistant`,
`synthetic`, `skill`, `shell`, `compaction`, `system`, `location-switched`,
`model-switched`, `agent-switched`, `idle`. `packages/schema/src/session-message.ts`.

**Step** — **one logical LLM call** and the durable record it produces. This is the only
unit called a step. `packages/core/src/session/runner/llm.ts` (`runStep`),
`packages/core/src/session/runner/step.ts`.

**Turn** — the conceptual unit from prompt promotion until the Session would go idle: a
sequence of steps. Reserved for that meaning only. Never use "turn" for a single model
call.

**Execution** — one process-local **busy period** for a Session: a single fiber that drains
from the first wake until the Session would stay idle. Coalesces many steps and many
drains. `packages/core/src/session/run-coordinator.ts`.

**Drain** — one pass of the runner over eligible durable work, returning either completion,
a continuation at the same place, or a reload/move. `SessionRunner.drain` in
`packages/core/src/session/runner/llm.ts`.

**Attempt** — one try at a single step, owning its streaming, tools, and durable
settlement. Retries are new attempts for the same step. `SessionStep.attempt` in
`packages/core/src/session/runner/step.ts`.

**Continuation** — the decision that another step should follow the current one, derived
from the durable record (`needsContinuation`, finish reason), never from in-memory intent.

**Settle / settlement** — writing the terminal durable facts for a span of work: a step's
finish or failure, a tool call's result or error, an execution's terminal event. Settling
is what makes a step resumable and inspectable. `settleStaleToolCalls`,
`settleStaleCompactions`.

## Admission and delivery

**Inbox** — the durable queue of work that has been **admitted** but not yet delivered
into visible history. It is pending-only: a row exists only while the work is unconsumed.
`packages/core/src/session/inbox.ts`.

**Admission** — recording that work exists, before any execution is scheduled. Admission
publishes `session.inbox.enqueued`, whose projection inserts the inbox row. Admission and
execution are deliberately separate.

**Delivery** — consuming an inbox row and inserting the visible message in the same
transaction. Two modes:

**Steer** — input that should influence work already in progress. Delivered at the next
safe step boundary.

**Queue** — input that should start new work. Delivered only when the Session would
otherwise go idle.

**Control item** — an inbox item that is not user text: `compaction` or `move`. Controls
interrupt promotion ordering and are never reordered across a `move`.

**Promote** — consume pending inbox rows and turn them into visible messages. Whether a
`queue` row may be consumed depends on scope: `steer` scope never promotes queued input;
`input` scope allows exactly one.

Prompts steer by default.

## State and events

**Event** — a durable fact published to the bus. Events are **minimal**: they record what
cannot be derived by folding history, and not derived state. `packages/schema/src/session-event.ts`.

**Projector** — the handler that folds an event into read models inside the same
transaction as the event's recording. `packages/core/src/session/projector.ts`.

**Read model** — a table shaped for querying a projection rather than for recording
history (messages, usage, stats, instruction state). Enrich read models with previous or
derived state so consumers get self-contained views.

**Bus** — the publish/subscribe point that carries events to projectors and to clients.
`packages/core/src/bus.ts`.

**seq** — the per-Session monotonic sequence number stamped on durable records, giving a
total order without relying on wall-clock time.

**Claim** — the write-ahead execution marker: a durable intent that a Session's turn is in
flight, written in the same transaction as the started event and released on a terminal.
A claim that survives with no terminal is the signature of a process that died. It is a
**recovery marker**, not clustered ownership, fencing, or an exactly-once guarantee.

## Context

**Instruction source** — one composable input to the system prompt (date, environment,
instruction files, skills catalog, MCP, references). Each has a stable `key` and renders
to text. `packages/core/src/instructions/index.ts`.

**Initial vs delta rendering** — an instruction source renders differently the first time
it appears (full text) and when it later changes (`changed` / `removed`). The delta is
appended to history as an update, so the model sees what changed without restating the
baseline.

**Hash / blob** — an instruction source's value is canonicalised and hashed; the value is
stored once in a blob table keyed by hash. Deltas carry hashes, not payloads.

**Context assembly** — building the provider request: selecting (session, agent,
instructions, tools) then loading (model, active history) then lowering to messages and
applying hooks.

**Lowering** — translating projected Session history into the provider's
`Message`/`ContentPart` model. `packages/core/src/session/runner/to-llm-message.ts`.

## Tools

**Tool** — a callable capability the model may invoke: name, options, description, input
schema, output schema, and an executor. `packages/core/src/tool.ts`.

**Effective name** — the model-facing name after namespacing and normalisation. A tool in
namespace `foo.bar` named `baz` becomes `foo_bar_baz`. Non-alphanumerics become `_`.

**Namespace** — a group that flattens a tool's model-facing name and may carry one shared
description. Registered once; tools reference it by string.

**Snapshot** — the per-request capture of a tool set: the definitions the model will see
and the captured executor that can run them. Later registry changes do not affect an
issued snapshot.

**CodeMode** — the mode in which tools are exposed to the model as a single `execute`
tool plus a rendered catalog, so the model writes code that calls the tools rather than
emitting one tool call per tool. A tool with `codemode: false` stays on the provider's
native tool list.

**Hosted / provider-executed tool** — a tool the provider runs itself (for example a
search tool). Its result payload is provider-format data and stays replayable within the
provider; its call-side metadata does not.

**Bound / bounding** — replacing an oversized tool result with a retained head plus a
marker naming a file that holds the full output. `packages/core/src/tool-output.ts`.

## Permissions and control

**Ruleset** — an ordered list of permission rules; the last matching rule wins. A rule has
`action`, `resource` (wildcards allowed), and `effect` (`allow` | `ask` | `deny`).

**Defect tunnel** — the deliberate use of the defect channel to carry a user's decline past
fault-tolerant boundaries, so a "no" can never be turned into model-visible tool output. It
resurfaces as a typed failure at the execution boundary. A decline **with feedback**
(`CorrectedError`) stays typed instead, so the model continues with the feedback.

**Question** — the tool that asks the user structured questions mid-execution. Dismissal is
tunnelled like a decline; a dismissal carrying a message is ordinary model feedback.

## Lifecycle

**Location** — the scoped environment a service graph is built for: working directory and
project/workspace identity. Most agent services are Location-scoped; the runner,
permissions, tools, and filesystem are.

**Instance** — the provisioned service graph for a Session's Location.

**Snapshot (filesystem)** — a captured state of the working tree, used to compute the file
changes a step produced and to support revert.

**Diff** — the change set between two snapshots (or a snapshot and the working tree).

**Compaction** — replacing older history with a summary plus a verbatim recent window,
freeing context. Persisted as a `compaction` message.

**Checkpoint** — the durable record of a compaction as it appears to later requests: a
structured summary plus the newest kept-verbatim messages. Native checkpoints hold the
provider's opaque window instead of text.

## Effect primitives you will meet

Named once, then used:

- **Effect** — a description of a computation with typed success, typed error, and typed
  requirements.
- **Layer / Service** — a dependency graph and a named capability resolved from it.
- **Fiber** — a lightweight, interruptible concurrency unit.
- **Scope** — a lifetime; resources acquired in a scope are released when it closes.
- **Deferred** — a one-shot, awaitable promise.
- **Stream** — a pull-based sequence, used for provider output.
- **Cause** — the full reason a fiber ended: typed failures, defects, and interrupts.
- **Die / defect** — a non-recoverable error that bypasses typed error handling.
- **Interrupt** — cooperative cancellation; cleanup runs in finalizers.
