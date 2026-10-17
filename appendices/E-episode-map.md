# Appendix E — Episode map

The source text for the podcast season. One season, twenty episodes, from the smallest
loop that works to a roadmap for building your own. Each topic in the written material
carries a `Podcast notes` block; this appendix assembles those blocks into an arc, gives
every episode a spoken cold open, and holds the running bits the host can reuse.

Topic numbers follow `plans/00-writing-plan.md` exactly. Vocabulary follows Appendix D.
Nothing here cites code; the anchors live in the parts and in Appendix C.

---

## Season overview

A coding agent is not a clever prompt. It is a loop that talks to a model, runs tools, and
remembers what it did. This season builds that machine one piece at a time, starting from
the smallest thing that works: one call to a model, one tool result, one durable record.
You will see why the loop, not the prompt, is the product. You will watch state get
written down before anything acts, so a crash never loses the story. You will assemble a
prompt from parts, gate dangerous actions behind permission, and keep context from
overflowing. The same decisions keep returning: admit before you execute, record before
you act, decide continuation from what is written rather than from what you remember. By
the end you will be able to name every durable write on the request path and every failure
that shaped the design. The last episode hands you the order to build it in.

---

## The season at a glance

| Episode | Title | Topics covered | Cold open | Core takeaway | Closer |
|---|---|---|---|---|---|
| 1 | The loop is the product | 0.1–0.2 | A model on its own only talks; nothing touches the disk. | An agent is a loop plus tools plus state, not a prompt. | Next: what actually crosses the wire when you call a model. |
| 2 | Talking to a model | 1.1–1.2, 1.4 | Two providers, two shapes for the same message; your code should not care which. | Normalize the request and the stream once; keep provider quirks at the door. | A finished call raises a question: where does the answer live? |
| 3 | Everything is an event | 2.1–2.2, 2.5 | The screen shows a reply, but the database is the truth. | Record minimal facts; fold them into read models. | Work arrives before it runs. Next: the inbox. |
| 4 | The inbox | 2.3 | You type while the agent is mid-thought; who wins? | Admission and execution are separate; the inbox stays pending-only. | Pending work needs a machine to drain it. Next: the step machine. |
| 5 | The drain and step machine | 3.1–3.5 | One decision to keep going, and the whole design falls out of it. | One step is one model call, and continuation comes from the record. | Steps need tools. Next: what a tool promises. |
| 6 | Tool contracts | 5.1–5.3 | The model calls a tool with the wrong shape; now what? | A tool is a name, a schema, and an executor, validated at the boundary. | Tools return data. Next: how much of it you can afford. |
| 7 | Output is a budget | 1.3, 5.4, 7.5 | A tool dumps a hundred thousand lines into context; the next call fails. | Every result is bounded to a budget you set before you spend it. | The largest output of all is code. Next: run code as a tool call. |
| 8 | Code as a tool call | 5.5–5.8 | The model wants to call five tools; can it write one program instead? | Expose the toolkit as a single execute call and let the model compose. | Tools run inside a prompt. Next: how that prompt gets built. |
| 9 | The assembled prompt | 4.1–4.2 | Same conversation, different bytes every request; the cache never hits. | Assemble the prompt from stable parts in a cache-stable order. | Some parts change mid-session. Next: instructions, skills, and MCP. |
| 10 | Instructions, skills, MCP | 4.3–4.6 | Your house rules changed, but the model keeps seeing the old ones. | Track instruction sources by hash and send deltas, not the baseline. | Everything must become messages. Next: lowering. |
| 11 | Lowering to messages | 4.7 | Your history and the provider's message list are not the same shape. | Lowering is a pure translation from your history to the wire. | A session can delegate. Next: agents and subagents. |
| 12 | Agents and subagents | 4.8, 9.4 | The task is too big; one conversation cannot hold it. | Agents are configurations; subagents are child sessions with depth limits. | Agents touch files. Next: who is allowed to. |
| 13 | Permissions | 6.1–6.4 | The model tries to delete a directory you still need. | Rules decide ask, allow, or deny, and a decline never reaches model context. | Runs fail. Next: staying alive. |
| 14 | Staying alive | 8.1–8.3 | The connection drops halfway through an answer. | Retry, continue, or recover, chosen from an explicit error taxonomy. | A healthy run can still run out of room. Next: context is finite. |
| 15 | Context is finite | 7.1–7.4 | The window fills up and the model stops seeing the start. | Compact to a summary plus a verbatim recent window. | Work also arrives while work is running. Next: concurrency and steering. |
| 16 | Concurrency and steering | 9.1–9.3, 9.5 | Two sessions, one directory; who owns the files? | Scope by location, run one execution per session, steer at safe boundaries. | A run changes files. Next: capturing what changed. |
| 17 | Snapshots | 10.1–10.3 | The change looked right in the reply and wrong on disk. | Snapshot, diff, and revert make changes inspectable and undoable. | You need to see it happen. Next: watching it work. |
| 18 | Watching it work | 11.1–11.3 | A user refreshes mid-run and the whole answer replays from the start. | Stream events live and persist facts durably; keep the two separate. | Then the process dies. Next: crash and resume. |
| 19 | Crash and resume | 2.4, 8.4 | The machine loses power mid-step. | A surviving claim marks the dead run; recovery settles it cleanly. | You have seen the whole machine. Next: build your own. |
| 20 | Build your own | 12.1–12.2 | You want to build one; where do you start? | Follow the milestone order and avoid the catalogued pitfalls. | Series close. |

---

## Cold opens and talking points

### Episode 1 — The loop is the product

**Topics:** 0.1–0.2

**Spoken cold open.** Imagine you open a chat box and ask a question. You get words back.
Nothing moves on your disk. Nothing runs. The model only talks. Now imagine it can read a
file, edit it, and run the tests. That is the whole difference between a chatbot and an
agent, and it is not a smarter prompt. It is a loop. Call the model, let it ask for a
tool, run the tool, feed the result back, call again. Everything else this season is
detail hung on that loop. So start there. The loop is the product.

**Talking points.**
- The agent is a loop, not a prompt: model call, tool run, result fed back, decide again.
- State and permissions are what make the loop safe to leave running.
- The rule is one model call per step, with no in-memory tool loop.

### Episode 2 — Talking to a model

**Topics:** 1.1–1.2, 1.4

**Spoken cold open.** Before the loop can do anything, it has to talk to a model, and every
model speaks a slightly different dialect. One wants the system text in a field. Another
wants it as the first message. One streams tool arguments in fragments. You could
special-case each provider everywhere. Or you could put one door in front of all of them
and describe the request and the response once. This episode builds that door. It is the
boundary where provider quirks stop and your reasoning begins, and it decides what
correctness you can promise for everything upstream.

**Talking points.**
- Define the canonical request once: messages, system parts, tool definitions, options.
- Normalize the streaming events into one union with partial tool input and finish reasons.
- Some provider details leak into correctness, so decide what you replay and what you drop.

### Episode 3 — Everything is an event

**Topics:** 2.1–2.2, 2.5

**Spoken cold open.** You watch the agent reply. It looks like a conversation. But if the
process died right now, what would survive? Not the screen. A screen is only a view. The
thing that survives is a record of facts. A prompt was admitted. A step started. A tool
returned. This episode treats those facts as the source of truth and the conversation as
something you rebuild by folding them. Once you see state that way, questions like can I
resume, can I audit, can I rewind stop being features you add and become things you
already have.

**Talking points.**
- Sessions are ordered history with typed messages, addressed and resumable.
- Events record minimal facts; a projector folds them in the same transaction.
- Read models are shaped for queries but rebuilt from the durable record.

### Episode 4 — The inbox

**Topics:** 2.3

**Spoken cold open.** You are watching the agent work, and you type a correction. It is
already mid-thought. Do you interrupt it, or do you wait? If you wait, where does your
message sit until then? If you answer out of memory, a crash loses it. So the message goes
somewhere durable first, as a promise that work exists, before anything runs. This episode
separates two things people blur: accepting work, and doing work. That gap is what lets you
steer a live agent without losing a sentence.

**Talking points.**
- Admission records that work exists; delivery inserts the visible message.
- Steer influences work in progress; queue starts new work only when the session would idle.
- Control items like compaction and move have their own ordering rules.

### Episode 5 — The drain and step machine

**Topics:** 3.1–3.5

**Spoken cold open.** Here is the smallest version of the machine. It has to decide, over
and over, whether to call the model again. That one decision is the whole agent. It does
not ask what it meant to do. It reads what is written down, and from that it decides to
continue or stop. One model call, one step. Tools run, results come back, and then the same
question again. This episode walks the loop from wake to idle and shows why every decision
is made from the record and never from memory. Miss that, and resuming is guesswork.

**Talking points.**
- A drain advances to a step, runs it, and settles it before deciding.
- Tool calls run as parallel fibers, but each source keeps its own order.
- Step limits and a terminal step keep a runaway model from calling forever.

### Episode 6 — Tool contracts

**Topics:** 5.1–5.3

**Spoken cold open.** The model asks to run a tool. Its arguments are almost right, but not
quite. A field is missing. A number arrives as a string. If you pass that through, the tool
fails deep inside your code and the model gets a stack trace it cannot use. The fix is a
contract. A tool is a name, a description, a shape for the input, a shape for the output,
and a function that does the work. This episode is about that contract, and about failing
loudly and clearly at the boundary in a way the model can read and act on.

**Talking points.**
- A tool is a name, description, input schema, output schema, and executor.
- A request captures a snapshot of tools so later changes do not alter an issued request.
- Validation and error formatting happen at the boundary, in terms the model can correct.

### Episode 7 — Output is a budget

**Topics:** 1.3, 5.4, 7.5

**Spoken cold open.** The model runs a search and gets back a hundred thousand lines. It
does not need them all. It needs the first thing and the last thing. But now that whole
dump sits in context, and the next call is over budget or slower and duller. Output is a
budget, not a dump. Every result has a size you decide in advance, and anything larger gets
trimmed to a head plus a pointer to the full text on disk. This episode is about spending
context deliberately, in the request and in the reply.

**Talking points.**
- Output limits are reserved before the call; measured and estimated usage track against it.
- Oversized results are bounded to a head plus a file holding the full output.
- Fitting the reply to the remaining budget keeps the next call legal.

### Episode 8 — Code as a tool call

**Topics:** 5.5–5.8

**Spoken cold open.** By now the model can call tools, one call at a time. But some jobs
need ten calls in a row, with the output of each feeding the next, and doing that one round
trip at a time is slow and clumsy. What if, instead of calling tools, the model wrote a
short program that calls them? Give it one tool named execute, hand it a catalog of
everything else, and let it compose. That is code as a tool call. It changes what the model
can do in a single step, and it changes what you have to sandbox.

**Talking points.**
- The built-in toolkit is prompt design: each tool name and description shapes behavior.
- Dangerous tools such as patch and shell need tighter gating than read-only tools.
- CodeMode exposes one execute tool plus a rendered catalog so the model composes calls.
- Plugins register as additional tool sources without changing the loop.

### Episode 9 — The assembled prompt

**Topics:** 4.1–4.2

**Spoken cold open.** Every time you call the model, you send it a package: a system
prompt, tool descriptions, the conversation so far. Build that package slightly
differently each time, in a different order, with different whitespace, and the provider's
cache misses on every request. You pay full price and wait the full latency. This episode
is about assembling that package from parts, in an order that stays stable across calls, so
identical prefixes stay identical. It is the least glamorous episode and one of the ones
that most affects whether your agent feels fast.

**Talking points.**
- Assembly separates selection of what to include from loading of the active history.
- The system prompt is built from parts, with conditional tool guidance.
- A stable order across requests is what makes prompt caching effective.

### Episode 10 — Instructions, skills, MCP

**Topics:** 4.3–4.6

**Spoken cold open.** Your project has a rules file. The agent has been reading it all
session. Then someone edits that file, and now the model is still working from the old
rules and does not know. You could resend the whole file on every call, but that is waste.
This episode is about instruction sources that change: tracking each by a hash, sending the
full text once, and then only what changed. The same machinery carries skills and external
tool servers, each a source the model can be told about, each updated without restating the
baseline.

**Talking points.**
- Each instruction source has a stable identity and renders to text.
- The first render is full; a later render is a delta keyed by hash, with the value in a
  blob store.
- Discovery covers rules and config; skills and MCP add dynamic instruction and tool
  sources.

### Episode 11 — Lowering to messages

**Topics:** 4.7

**Spoken cold open.** Your session history and the provider's idea of a conversation are
not the same object. Yours has message types for skills, for compaction, for a model
switch. The provider deals in roles and content blocks, nothing more. Before anything goes
out the door, your history has to be lowered into the provider's shape. This episode is
about that translation: a pure function, no surprises, testable on its own. It sounds
small. It is where a lot of subtle bugs live, because one message of yours can become
several messages on the wire.

**Talking points.**
- Lowering translates projected history into provider messages and content parts.
- It is pure and testable, and it preserves the facts the model must see.
- The mismatch between your message types and provider roles is where bugs hide.

### Episode 12 — Agents and subagents

**Topics:** 4.8, 9.4

**Spoken cold open.** Some tasks are too big for one conversation. Investigate three
subsystems, fix two bugs, and write a summary. Stuff it all into one thread and the context
fills with noise and the model loses the plot. So you let the agent delegate. A subagent is
a child session with its own context and its own job, reporting back a result. This episode
is about agents as configurations and subagents as children, and about the one rule that
keeps delegation from running away: a depth limit.

**Talking points.**
- An agent is a reusable configuration: model, tools, and instructions.
- A subagent runs as a child session with its own context and returns a result.
- A depth limit stops a child from spawning children without end.

### Episode 13 — Permissions

**Topics:** 6.1–6.4

**Spoken cold open.** The agent decides to delete a directory, and you have a bad feeling
about that directory. This is the moment every user of an agent has felt. The honest fix is
not a smarter prompt telling it to be careful. It is a gate. Some actions are allowed, some
are denied, and some stop and ask you. And here is the subtle part: when you say no, that no
must never reach the model as if it were a tool result, or the model will argue with it.
This episode builds the gate and the tunnel that carries your refusal.

**Talking points.**
- A ruleset is ordered; the last matching rule wins, and wildcards are allowed.
- Ask, allow, and deny resolve at the boundary, with deferred replies for human latency.
- A decline is tunnelled so it never becomes model-visible tool output; a decline with
  feedback stays typed.

### Episode 14 — Staying alive

**Topics:** 8.1–8.3

**Spoken cold open.** The connection drops halfway through an answer. Nothing is wrong with
your code. The network blinked. Now what? Do you retry the whole thing? Continue from where
it stopped? Give up and ask for help? Most agents pick one of these blindly. This episode
treats the choice as a decision, made from a clear classification of what actually went
wrong, and it insists that whatever happens, the failure gets written down so the next run
knows where it stands.

**Talking points.**
- A retry policy decides how many times and how far apart, with backoff.
- The taxonomy separates retry, continue, and recover-full so the right one is chosen.
- Content filters, unknown finishes, and incomplete streams each have a defined response.

### Episode 15 — Context is finite

**Topics:** 7.1–7.4

**Spoken cold open.** Sooner or later the context runs out. The conversation grows, tool
results pile up, and the model is now reading a book where the important part is at the top
and it has started skimming. You cannot delete the top; that is where the task lives. So
you compact. You replace the old history with a summary and keep the newest exchange word
for word, and you do it at a point where the model is not mid-sentence. This episode is
about deciding when, and doing it without losing the thread.

**Talking points.**
- The decision compares measured and estimated size against a ceiling with a reserve.
- A trigger starts a shrink loop that summarises and keeps a recent window verbatim.
- The result is a checkpoint; native compaction keeps the provider's opaque window instead.

### Episode 16 — Concurrency and steering

**Topics:** 9.1–9.3, 9.5

**Spoken cold open.** Two sessions are open on the same project. One edits a file while the
other is testing. Who is supposed to win? If you never answered that question, you will get
corrupted work and blame the model. The answer starts with scope: work is tied to a place,
and each place has one owner of the run. Add to that the fact that a person can type while
the agent works, and you need rules for when that input is heard. This episode is about
coordination: one execution per session, steering at safe points, and keeping concurrent
work honest.

**Talking points.**
- Services are Location-scoped; the runner, permissions, tools, and filesystem follow that
  scope.
- The run coordinator joins resumes, coalesces wakeups, and lets different sessions run
  concurrently.
- Steering is heard at a safe step boundary; queued input waits; interruption is a control.

### Episode 17 — Snapshots

**Topics:** 10.1–10.3

**Spoken cold open.** The agent says it fixed the bug. You look at the file. It did not. Or
it changed three things you did not expect. How would you even know? A reply is a claim,
not evidence. So the agent takes a snapshot before it touches anything, and again after,
and subtracts. What falls out is the real change set: which files, which lines. From there,
reverting is a matter of choosing an earlier snapshot. This episode is about making the
agent's work inspectable, so you can check it and undo it instead of trusting a sentence.

**Talking points.**
- A snapshot captures working-tree state at a point in time.
- A diff between snapshots gives the files a step actually changed.
- Revert restores an earlier snapshot so a bad change can be undone.

### Episode 18 — Watching it work

**Topics:** 11.1–11.3

**Spoken cold open.** You have a long run going and you close the tab. When you come back,
the work is still happening, and the screen catches up from the beginning, replaying every
event as if it were happening now. That is not a bug; it is a design. The live stream and the
durable record are two different things, and the client subscribes to events and folds
them. This episode walks the path from the bus, through the server, out to a client, and
draws the line between what you stream and what you persist.

**Talking points.**
- Events flow from the bus to the server and out to clients as a live stream.
- A client can drive and observe the agent through the same event feed.
- Durable facts are persisted; rendering data is streamed, and the two are kept apart.

### Episode 19 — Crash and resume

**Topics:** 2.4, 8.4

**Spoken cold open.** The machine loses power in the middle of a step. There is no goodbye,
no cleanup, no chance to write down what happened. When it comes back, how does it know it
was interrupted, and not merely idle? Here is the trick. Before a run does anything, it
writes a marker that says work is in flight, and it only clears that marker when the work
ends. A marker that survives with no ending is the fingerprint of a crash. This episode is
about reading that marker and settling a dead run cleanly, so the next one starts from
truth.

**Talking points.**
- The write-ahead claim records intent in flight and is released on a terminal.
- Startup recovery finds surviving claims and resumes the affected sessions.
- Stale settlement closes out tool calls and compactions left open by the crash.

### Episode 20 — Build your own

**Topics:** 12.1–12.2

**Spoken cold open.** You have seen the whole machine now: the loop, the model boundary,
the events, the inbox, the tools, the prompt, the permissions, the retries, the compaction,
the concurrency, the snapshots, the stream. The tempting thing is to build it all at once
and watch it fall over. The better thing is to build it in order, starting from the
smallest loop that can call a model and run one tool, and adding one hard-won lesson at a
time. This last episode is a roadmap and a list of the pitfalls waiting on the way. Then it
is on you.

**Talking points.**
- The milestone roadmap orders the build so each stage is testable on its own.
- The pitfall catalog names the mistakes that are easy to make and hard to debug.
- Build the durable record early; retrofitting state after the loop works is painful.

---

## Running bits and callbacks

- **The loop is the product.** The stop-or-continue decision every step is the agent; the
  prompt is an input to it, not the agent itself.
- **Write it down before you do it.** Admission, the write-ahead claim, and settlement all
  record intent before acting, which is what makes a crash survivable.
- **Read the record, not your memory.** Continuation and recovery are decided from durable
  state, never from what the running process happens to remember.
- **The door.** The model boundary is one place where every provider's quirks are
  normalized, so they stop leaking into the rest of the agent.
- **A contract, not a hope.** A tool is a schema plus an executor; bad input fails at the
  boundary in terms the model can correct.
- **Output is a budget.** Context is a resource you spend deliberately, bounding results and
  reserving room before the call.
- **A no is not a tool result.** A decline is carried past fault-tolerant boundaries so it
  never appears to the model as something to argue with.
- **Snapshot, subtract, decide.** The disk is the evidence; a diff between snapshots is what
  really changed, and revert is how you take it back.

---

## Listener questions by episode

**1 — The loop is the product**
- Is this only prompt engineering? No; the prompt is one input to a loop that also runs
  tools and persists state.
- How small can the loop be? One model call, one tool, one saved record; everything else is
  elaboration.

**2 — Talking to a model**
- Why not call each provider's SDK directly everywhere? Then every provider's quirks leak
  into agent logic; the boundary keeps them in one place.
- Do I need to support every provider shape? No; support the shapes you use and normalize
  them into one request type.

**3 — Everything is an event**
- Why events instead of saving only the final messages? Events record the minimal facts;
  folding them gives you messages and everything else.
- Is an event log not expensive? You keep it small on purpose: irreducible facts only, with
  derived state living in read models.

**4 — The inbox**
- What happens to my message if I close the app? It stays in the inbox, durable, until it is
  delivered.
- Can I change my mind after sending? Yes, while it is still pending; between admission and
  delivery it can be cancelled or changed.

**5 — The drain and step machine**
- How does it know when to stop? From the recorded finish reason and the step limit, not
  from a guess about intent.
- Why one model call per step rather than an in-memory tool loop? So every step has one
  durable record and the run stays resumable and inspectable.

**6 — Tool contracts**
- What if the model sends bad arguments? Validation fails at the boundary and the error is
  formatted for the model to correct.
- What if two tools share a name? Namespacing flattens and normalizes names into one
  effective name, which avoids collisions.

**7 — Output is a budget**
- Why not truncate the output and move on? You keep a head plus a pointer to the full text
  on disk so nothing is lost.
- Who decides the budget? You do, in the request; measured and estimated usage track against
  it.

**8 — Code as a tool call**
- Is model-written code safe to run? Only inside the boundary you control, which is why
  CodeMode changes what you must sandbox.
- Why not let the model call tools normally? For multi-step work, one composed program beats
  many round trips.

**9 — The assembled prompt**
- Does ordering really affect cost? Yes; cache hits depend on identical prefixes, so
  unstable ordering costs full price on every call.
- What belongs in the system prompt? Stable, conditional parts such as tool guidance and
  instructions, in a fixed order.

**10 — Instructions, skills, MCP**
- Why not resend everything each time? Instruction sources are hashed and sent as deltas, so
  only changes travel.
- What are skills and MCP here? Additional instruction and tool sources the agent can
  discover and keep updated.

**11 — Lowering to messages**
- Why not store the provider's messages directly? Your history is richer; lowering
  translates it, and one message of yours can become several.
- Where do bugs hide in lowering? In the mapping between your message types and the
  provider's roles and content blocks.

**12 — Agents and subagents**
- Can subagents spawn more subagents? Yes, but a depth limit stops runaway recursion.
- Do subagents share context? No; each is a child session with its own context that reports
  a result back.

**13 — Permissions**
- What happens when I deny an action? The refusal is tunnelled so it never appears as tool
  output; the model cannot argue with it.
- Can I give feedback with a deny? Yes; a decline with feedback stays typed and the model
  continues with your correction.

**14 — Staying alive**
- Why not always retry? Some errors are permanent; retrying a content filter or a stopped
  stream will not help.
- What is the difference between retry and recover-full? A retry re-runs the failed attempt;
  recover-full rebuilds the run from the durable record after a crash.

**15 — Context is finite**
- Do I lose the old conversation? The recent window stays verbatim; older parts become a
  summary.
- When is the right time to compact? Before you cross the ceiling, at a safe point, using
  measured and estimated usage.

**16 — Concurrency and steering**
- Can two sessions edit the same directory at once? Work is scoped to a location and one
  execution owns a session's run, so concurrency needs that discipline.
- How does steering differ from queueing? Steering influences work in progress at the next
  safe step; queued input waits until the session would otherwise idle.

**17 — Snapshots**
- Where do snapshots live? They capture working-tree state so a step's changes can be
  computed and reverted.
- Can I undo a single step? Revert goes to a chosen snapshot, so you can return to the state
  before a step.

**18 — Watching it work**
- Why does the client replay events? It subscribes to the stream and folds events, so a
  fresh client catches up from the record.
- Should I store everything I stream? No; persist durable facts, stream what clients need to
  render, and keep the two separate.

**19 — Crash and resume**
- How does it tell a crash from idle? A claim written before the run and never cleared is
  the signature of a process that died.
- Is recovery exactly-once? No; the claim is a recovery marker, not fencing or an
  exactly-once guarantee.

**20 — Build your own**
- What should I build first? The smallest loop: call a model, run one tool, record the
  result.
- What trips people up most? Skipping durable state and deciding continuation from memory.

---

## Do not say

These terms are easy to misuse. Use them with the meaning in Appendix D.

| Term | Do not use it to mean | It means |
|---|---|---|
| step | a whole answer or a full sequence of work | one logical model call and the durable record it produces |
| turn | a single model call | the conceptual unit from prompt promotion until the session would go idle; it contains several steps |
| execution | one model call or one step | one process-local busy period: a single fiber draining from the first wake until the session would stay idle |
| attempt | a retry, or a step | one try at a single step; a retry is a new attempt for the same step |
| drain | a whole run | one pass of the runner over eligible durable work |
| steer | any input | input meant to influence work already in progress, delivered at the next safe step boundary |
| queue | any input | input meant to start new work, delivered only when the session would otherwise go idle |
| compaction | a saved checkpoint | replacing older history with a summary plus a verbatim recent window |
| checkpoint | the act of compacting | the durable record of a compaction as later requests see it |
| hosted (provider-executed) tool | a local tool the model calls | a tool the provider runs itself, whose result is provider-format data |
| local tool | a hosted tool | a tool your code registers and executes after validation and permission |

Additional phrasing rules:

- A retry is not a new step; it is a new attempt for the same step.
- Recover-full is not a retry; it rebuilds the run from the durable record.
- A claim is a recovery marker, not clustered ownership and not an exactly-once guarantee.
- Prompts steer by default; "steer" and "queue" are delivery modes, not tones of voice.
