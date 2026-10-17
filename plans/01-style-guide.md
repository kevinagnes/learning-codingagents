# Style guide — "Anatomy of a Coding Agent"

Every part of this material follows this guide. Read it fully before writing.

## Voice and audience

- Address a **well-versed developer** directly as "you". They can read code, reason about
  concurrency, and do not need motivation to care about correctness.
- Assume **no Effect knowledge**. Effect is opencode's substrate; it is not the subject.
  Teach what the code does in plain terms, then name the Effect primitive once
  ("a `Deferred` is a one-shot promise") and move on.
- Assume **no opencode knowledge**. Define every domain term on first use.
- Direct, concrete, unsentimental. No hype, no filler, no "simply", no "just", no "obviously",
  no emoji, no exclamation marks.
- Short paragraphs. Prefer a bullet list over a run-on sentence. Prefer a table when
  comparing three or more things.
- Name the failure mode before the fix. Readers remember designs by the problem they solve.

## The unit of work: one topic

Each topic is a numbered section (`## 3.2 ...`) with exactly these eleven parts, in order,
using these exact headings:

1. `### Thesis` — one sentence. What this topic establishes.
2. `### Cold open` — a concrete, recognizable failure or question. Two to four sentences.
   This becomes the podcast hook, so it must stand alone without jargon.
3. `### The concept` — stack-agnostic explanation, with the *why* and the alternatives
   that were rejected and why. This is the bulk of the section.
4. `### Diagram` — reference a diagram by id (`D6`) and include it inline (see Diagrams).
5. `### The real thing` — opencode's implementation. Cite `path:line` anchors and include
   verbatim excerpts. End with a short "What to notice" list.
6. `### The prompts` — verbatim prompt text this topic owns, with provenance and design
   commentary. If the topic owns no prompts, write "No prompts in this topic — the prompts
   live in Appendix A under <group>." and stop.
7. `### Build it` — minimal pseudocode a reader could actually implement, plus the
   decisions and trade-offs. Language: TypeScript-flavoured pseudocode, or plain
   structured English where code would obscure the point.
8. `### How it fails` — the failure modes and how each shows up in practice.
9. `### How you'd test it` — the invariant to assert. Test the real behaviour; never
   describe a mock.
10. `### Recap` — three bullets. Then one transition sentence to the next topic.
11. `### Podcast notes` — `Hook:` one line. `Analogy:` one line. `Talking points:` two to
    three lines. `Listeners will ask:` one line.

A part file starts with a short orientation paragraph (3–6 sentences) and a bullet list of
its topics, then the topics.

## Code excerpts

- Always show the anchor immediately above or inside the fence:
  `// packages/core/src/session/runner/llm.ts:57`
- Quote **verbatim**, trimmed only for length. Use `…` for elisions and never silently
  rewrite a line.
- Trim to the idea. Ten to forty lines is the working range; longer only when the flow is
  the point.
- After each excerpt, a "What to notice" list of two to five bullets naming the load-bearing
  details.

## Prompts are prompt engineering, not prose

Treat every prompt, tool description, and model-facing error string as a designed artifact:

- Quote it verbatim in a fenced block.
- State its provenance (`file:line`).
- Explain what each non-obvious phrase buys and what would break without it.
- Where relevant, show the failure the phrase prevents (e.g. a model that invents a tool
  call after the step limit).

The canonical prompt set lives in Appendix A. Cite it by name; do not duplicate long
prompts across parts — quote the part that matters and link.

## Diagrams

- Inline in the part file, under `### Diagram`.
- Every diagram ships **three forms**:
  1. A Mermaid block (```mermaid).
  2. An ASCII fallback (```text) for terminals and slides.
  3. A one-paragraph narration suitable for reading aloud.
- Ids are global and stable: `D1`…`D15` for the seeded set; if you need another, take the
  next free number and record it in Appendix B.
- Prefer `flowchart` for pipelines, `stateDiagram-v2` for lifecycles and state machines,
  `sequenceDiagram` for request/response interactions. Do not use git-path branching.
- Label edges with what changes, not with generic words like "process".

Seeded ids:

| id | subject |
|---|---|
| D1 | layering and module dependencies |
| D2 | end-to-end request lifecycle (client → inbox → drain → step → tool → projection → client) |
| D3 | durable event → projection → read model |
| D4 | inbox delivery state machine |
| D5 | run coordinator: execution, doorbell, interrupt |
| D6 | step internals: stream + tool fibers + settlement |
| D7 | tool-call lifecycle |
| D8 | context assembly pipeline (select/load → transcript → hooks → request) |
| D9 | compaction decision and shrink loop |
| D10 | retry / continue / recover-full decision tree |
| D11 | subagent lifecycle and jobs |
| D12 | permission evaluation and the defect tunnel |
| D13 | token and context budget |
| D14 | instruction hash/delta flow |
| D15 | snapshot / diff / revert |

## Accuracy rules

- Only cite a `path:line` you have opened in this session.
- Say "at the time of writing" once per file is enough; do not hedge every claim.
- Distinguish **what the code does** from **what you should do**. Mark the latter
  "Design note:".
- Distinguish normative commentary in code (`// ...` comments that state a rule) from
  incidental implementation. opencode's comments are unusually explicit; quote them when
  they state an invariant, because they are the best available explanation of intent.
- Use **step** for one logical LLM call, **execution** for one busy period and its drain
  loop, **turn** only as the conceptual unit from prompt promotion until the session would
  go idle. Never use "turn" for a single model call. Follow the glossary exactly.

## Language discipline

Use the glossary's terms with the glossary's meaning:

session · message · event · projector · read model · inbox · admission · delivery ·
steer · queue · control item · promote · step · execution · drain · attempt · span ·
settle · continuation · compaction · checkpoint · claim · Location · instance ·
snapshot · diff · effective name · namespace · codemode · instruction source · delta ·
defect tunnel · hosted tool · provider-executed tool.

## What "done" looks like

A reader who finishes all thirteen parts can:

1. Draw the request lifecycle from memory and name every durable write on it.
2. Explain why admission is separate from execution, and why the inbox is pending-only.
3. Implement a stop/step loop that decides continuation from recorded state, not memory.
4. Register a tool, validate its input, and bound its output.
5. Assemble a system prompt that stays cache-stable, and update it by hash delta.
6. Gate a tool behind a permission that never leaks a "no" into model context.
7. Compact a conversation without losing the newest exchange.
8. Recover a crashed session from the database alone.
9. Explain the run coordinator's doorbell in one sentence.
10. Spawn a child session that cannot recurse without a depth limit.
