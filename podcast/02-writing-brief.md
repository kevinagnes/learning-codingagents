# Writing brief — Episodes 2 to 20

The single source of truth for the rest of the season. Read this, then `00-format.md`, then
`01-script-style.md`, then the pilot at `scripts/ep01.md`. The pilot is the reference for
voice, rhythm, and density. Match it.

## Mission

Each episode takes the topics assigned to it from `../` and turns them into a 25-minute,
two-host conversation that a developer can follow once, by ear, and act on. Every factual
claim traces to a topic in the written material. Nothing is invented.

## The shape of every episode

Ten segments, in order, with these budgets. Total spoken words must land between 3,200 and
3,600.

| # | Segment | Words | Notes |
|---|---|---|---|
| 1 | Cold open | 110–140 | `HOST` alone. A concrete failure or question. No greeting, no show name. |
| 2 | Titles and promise | 85–110 | Name the show and the episode. Exactly one promise. |
| 3 | Bridge | 50–75 | One line recapping the previous episode's takeaway, then move. |
| 4 | Body beat 1 | 560–640 | |
| 5 | Body beat 2 | 560–640 | |
| 6 | Body beat 3 | 560–640 | |
| 7 | Body beat 4 | 560–640 | |
| 8 | The artifact | 250–320 | Read one artifact verbatim, then interpret it. |
| 9 | Recap | 100–120 | Three bullets plus this episode's rule. |
| 10 | Teaser and outro | 100–120 | The next episode's question, then the sign-off. |

Exactly four body beats. If the topics do not fill four, find the four real decisions in
them; do not pad with a fifth. If they overflow, cut.

### The beat formula

Every beat does these four moves in order:

1. **Claim.** `HOST` states one sentence that is either true or false.
2. **Example.** The case that breaks the naive version, or the case that makes the design
   necessary. Usually `CO-HOST` raises it.
3. **Mechanism.** How it is actually done, from the source material. This is where `EXPERT`
   may appear.
4. **Takeaway.** One sentence a listener could repeat at lunch.

Close each beat by handing the next question to the other host.

### Using EXPERT

At most once per episode, and only where the design is genuinely counterintuitive: a
reasonable engineer would choose the opposite. Two to four turns. In, one point, out. Not
every episode needs one. Episodes about mechanics (inbox, compaction, retries) usually do
not; episodes about a surprising choice (one call per step, declines as defects, native
compaction) do.

### The artifact

Read one real artifact aloud, verbatim, then interpret it. Announce it first: "Here it is,
word for word." Keep the read under 120 words; if it is longer, read the load-bearing part
and say the rest is in the companion. Never paraphrase inside the quote.

Assignments, so no two episodes repeat:

| Episode | Artifact | Where it comes from |
|---|---|---|
| 2 | the canonical request: system parts, messages, tool definitions, options | Part 1.1, Appendix A group Harness |
| 3 | the rule that durable events record irreducible facts only | Part 2.2, and the root AGENTS.md "Session Core" section |
| 4 | the inbox's steer and queue definitions | Part 2.3 |
| 5 | the maximum-steps prompt | Appendix A, Loop |
| 6 | the tool input validation error the model sees | Part 5.3, Appendix A, Tools |
| 7 | the truncation marker and the image-removed marker | Part 5.4, Appendix A, Tools |
| 8 | one built-in tool description, verbatim | Part 5.5, Appendix A, Tools |
| 9 | the base system prompt | Appendix A, Harness |
| 10 | the skills catalog as the model sees it | Part 4.5, Appendix A, Instructions |
| 11 | the conversation-checkpoint wrapper | Part 4.7 |
| 12 | the subagent tool description | Part 9.4, Appendix A, Tools |
| 13 | the question tool description | Part 6.4, Appendix A, Tools |
| 14 | the two continuation strings | Part 8.2, Appendix A, Loop |
| 15 | the compaction summary template | Part 7.3, Appendix A, Compaction |
| 16 | the coordinator's doorbell comment | Part 9.2 |
| 17 | the revert semantics | Part 10.3 |
| 18 | the event envelope and manifest idea | Part 11.1 |
| 19 | the recovery comment about orphaned claims | Part 2.4 |
| 20 | the milestone ladder | Part 12.1 |

## Serial contract

The season is listened to in order. Two hard rules:

**Bridge (segment 3).** Start from the previous episode's takeaway, in one sentence, then
turn to today. Use this exact formula:

> "Last time we established that <previous takeaway>. Today <this episode's question>."

Do not say "in the previous episode we covered"; say what was established.

**Teaser (segment 10).** Pose the next episode's opening question using the next episode's
closer from the table below, then sign off with:

> "That is Anatomy of a Coding Agent. Every code excerpt behind this episode is in the
> companion notes."

Refer to other episodes by number and title, never by part or appendix.

### Neighbour table

| Ep | Title | Previous takeaway (for the bridge) | Next closer (for the teaser) |
|---|---|---|---|
| 2 | Talking to a model | an agent is a loop plus tools plus state, not a prompt | Where does the answer live? |
| 3 | Everything is an event | normalize the request and the stream once, and keep provider quirks at the door | Work arrives before it runs. |
| 4 | The inbox | record minimal facts and fold them into read models | Pending work needs a machine to drain it. |
| 5 | The drain and step machine | admission and execution are separate, and the inbox stays pending-only | Steps need tools. |
| 6 | Tool contracts | one step is one model call, and continuation comes from the record | Tools return data, and data has a size. |
| 7 | Output is a budget | a tool is a name, a schema, and an executor, validated at the boundary | The largest output of all is code. |
| 8 | Code as a tool call | every result is bounded to a budget you set before you spend it | Tools run inside a prompt. |
| 9 | The assembled prompt | expose the toolkit as a single execute call and let the model compose | Some parts of the prompt change mid-session. |
| 10 | Instructions, skills, MCP | assemble the prompt from stable parts in a cache-stable order | Everything must become messages. |
| 11 | Lowering to messages | track instruction sources by hash and send deltas, not the baseline | A session can delegate. |
| 12 | Agents and subagents | lowering is a pure translation from your history to the wire | Agents touch files. |
| 13 | Permissions | agents are configurations, and subagents are child sessions with depth limits | Runs fail. |
| 14 | Staying alive | rules decide ask, allow, or deny, and a decline never reaches model context | A healthy run can still run out of room. |
| 15 | Context is finite | retry, continue, or recover, chosen from an explicit error taxonomy | Work also arrives while work is running. |
| 16 | Concurrency and steering | compact to a summary plus a verbatim recent window | A run changes files. |
| 17 | Snapshots | scope by location, run one execution per session, and steer at safe boundaries | You need to see it happen. |
| 18 | Watching it work | snapshot, diff, and revert make changes inspectable and undoable | Then the process dies. |
| 19 | Crash and resume | stream events live and persist facts durably, and keep the two separate | You have seen the whole machine. |
| 20 | Build your own | a surviving claim marks the dead run, and recovery settles it cleanly | Series close. |

## The rule list (for recaps)

Each episode's recap restates its own rule. From episode 5, the recap also names two or
three earlier rules so listeners hear the list accumulate. Keep it to one sentence.

1. One model call per step. No in-memory tool loop. (Ep 1)
2. Normalize the provider at one door. (Ep 2)
3. Record the fact before anyone acts. (Ep 3)
4. Admission is not execution. (Ep 4)
5. Continuation is read from the record. (Ep 5)
6. Validate at the boundary, and bound every output. (Eps 6 and 7)
7. A decline never reaches model context. (Ep 13)
8. Decide retry, continue, or recover from the taxonomy. (Ep 14)
9. Compact to a summary plus the newest exchange. (Ep 15)
10. One execution per session. (Ep 16)

## Hard style rules

`01-script-style.md` is authoritative. These are the ones that get broken:

- No digits in spoken lines. Spell every number.
- No backticks, no code, no file paths, no camelCase, no diagram labels, no "Part N", no
  "Appendix", no "D2".
- No "just", "simply", "obviously", "basically", "leverage", "utilize", "at the end of the
  day". No ellipses.
- Sentences under about twenty-five words. Prefer periods to dashes. No semicolons. No
  parentheses in spoken text.
- A speaker label alone on its line, then the spoken text below it.
- Stage directions in square brackets on their own line, never spoken.
- `CO-HOST` gets roughly 25 to 30 percent of the words. If the host share is above 75
  percent, give the co-host more real pushback.
- Never call a step a turn. Never swap steer and queue. Never call a checkpoint a compaction.

## Files to write, per episode

```
scripts/epNN.md      the read-aloud script
beats/epNN.md        the beat sheet
companion/epNN.md    show notes
```

### `scripts/epNN.md`

Front matter exactly like the pilot: title, topics, runtime target, cast, artifact, sources,
companion. Then the ten segments as `## N. Name` headings. Headings and front matter are
never spoken.

### `beats/epNN.md`

A production beat sheet, not prose. For each of the four beats:

- the beat's one-sentence claim
- the source (topic number and part)
- the example or question the co-host raises
- the mechanism, in three or four bullets
- the takeaway line, written as it will be spoken
- the words allocated

Then two short lists: "terms to define on first use" and "do not say in this episode".

### `companion/epNN.md`

- A claims-to-sources table.
- Three to five code excerpts, copied **verbatim from the part files**, including their
  `// path:line` anchor lines. Do not write new code.
- The episode's diagram, referenced by id, with a one-line pointer to Appendix B.
- Vocabulary introduced in the episode.
- The next episode line.

## Self-check before you hand back

Run the validator from the podcast directory:

```sh
node scripts/check-episodes.ts epNN
```

It reports word counts per segment, total runtime, and every style violation. Fix until it
passes. Then run the anchor checker from the repository root to confirm the companion's
excerpts still resolve:

```sh
node docs/agent-architecture/scripts/check-anchors.ts
```

## Episodes at a glance

| Ep | Title | Topics | Source part |
|---|---|---|---|
| 2 | Talking to a model | 1.1, 1.2, 1.4 | Part 1 |
| 3 | Everything is an event | 2.1, 2.2, 2.5 | Part 2 |
| 4 | The inbox | 2.3 | Part 2 |
| 5 | The drain and step machine | 3.1–3.5 | Part 3 |
| 6 | Tool contracts | 5.1–5.3 | Part 5 |
| 7 | Output is a budget | 1.3, 5.4, 7.5 | Parts 1, 5, 7 |
| 8 | Code as a tool call | 5.5–5.8 | Part 5 |
| 9 | The assembled prompt | 4.1, 4.2 | Part 4 |
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
| 20 | Build your own | 12.1, 12.2 | Part 12 |
