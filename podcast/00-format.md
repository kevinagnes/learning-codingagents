# Format spec — Anatomy of a Coding Agent (Season 1)

The contract for the podcast. Scripts are written against this file. If a script disagrees
with this file, this file wins.

## Show

**Title.** Anatomy of a Coding Agent.

**Premise.** How a coding agent actually works, taught from opencode's implementation. One
season, twenty episodes, serial. Each episode takes one idea from the written material in
`docs/agent-architecture/` and makes it audible.

**Source material.** The thirteen parts and five appendices under `docs/agent-architecture/`.
Every factual claim in a script traces to a topic there. Episode sources are listed in each
script's header and in the show notes.

**Companion.** Every episode has a companion note that carries what audio cannot: code
excerpts, file paths, the full prompt text, and diagrams. Listeners are told, twice per
episode at most, that the companion has the code.

## Cast

Three voices, all spoken by the same three engine voices across the whole season so the
speakers stay recognisable.

| Label | Voice | Job |
|---|---|---|
| `HOST` | the builder | Knows the implementation. Drives structure, states the thesis, owns the recap. |
| `CO-HOST` | the sharp listener | Asks the question the audience has, names the cost, pushes back once per beat. Never a strawman. |
| `EXPERT` | the specialist | Optional third voice, at most once per episode, only where the design is genuinely counterintuitive. Speaks in the first person plural about the implementation. |

`EXPERT` is not a character arc. It is the same voice every time, used when the material
contains a decision that a reasonable engineer would get wrong.

The labels double as the text-to-speech speaker names. Keep them exactly as written.

## Episode length and budget

Target **25 minutes** of finished audio. Spoken pace is about 150 words per minute, so the
script target is **3,200 to 3,600 words**, which leaves room for pauses, music, and the
artifact read to land at about 25 minutes.

Every episode has these segments in this order.

| # | Segment | Time | Words | What it does |
|---|---|---|---|---|
| 1 | Cold open | 45 s | ~110 | A concrete failure or question. No greeting, no show name, no music under the first line. |
| 2 | Titles and promise | 45 s | ~110 | Name the show, name the episode, make exactly one promise. |
| 3 | Bridge | 30 s | ~75 | One line of recap from the previous episode, then move. |
| 4 | Body beat 1 | 4 min | ~600 | Claim, example, how it is actually done, listener takeaway. |
| 5 | Body beat 2 | 4 min | ~600 | Same shape. |
| 6 | Body beat 3 | 4 min | ~600 | Same shape. |
| 7 | Body beat 4 | 4 min | ~600 | Same shape. |
| 8 | The artifact | 2 min | ~300 | Read one real artifact aloud, word for word, then interpret it. |
| 9 | Recap | 45 s | ~110 | Three bullets, spoken, plus the episode's rule restated. |
| 10 | Teaser and outro | 45 s | ~110 | The next episode's question, then the sign-off. |

**Exactly four body beats.** Not three, not six. If the material has more, cut. If it has
less, the episode is short and that is fine.

### The body beat

Every beat has the same four moves, in order:

1. **Claim.** `HOST` states one sentence that is either true or false, and promises to show
   which.
2. **Example.** `CO-HOST` gives the case that breaks the naive version, or `HOST` gives the
   case that makes the design necessary.
3. **How it is actually done.** The mechanism, from the source material. This is where
   `EXPERT` may appear.
4. **Listener takeaway.** One sentence a listener could repeat at lunch.

### The artifact

`HOST` reads one real artifact aloud, verbatim, and then the two hosts interpret it. Usually
it is a prompt. It can also be a rule the project encodes, or a list of schema fields,
whichever is most revealing for the episode. Rules for reading artifacts are in the style
guide. Keep the read under about 120 words; if the artifact is longer, read the load-bearing
part and tell listeners the rest is in the companion.

## Voice and sound

- Cold open: no music under the first sentence. Music may enter after the hook line.
- Music bed under titles and promise, then out.
- Light bed under the recap; out under the teaser.
- No sound effects except at segment boundaries. Nothing is played while a prompt is being
  read.
- No laughter, no audience, no stingers.

## Serial structure

The season is serial. Each episode assumes the previous one.

- The bridge (segment 3) names the previous episode's takeaway in one sentence.
- The teaser (segment 10) poses the next episode's opening question.
- Refer to earlier episodes by number and title, never by part or appendix: "three episodes
  ago, in the inbox episode." Never "in Part 2."

## The cumulative rule list

The material has one central rule and a growing list of invariants. Each episode's recap
restates that episode's rule, and from episode 5 the recap also names the running list so
listeners hear it accumulate. The rules, in order of introduction:

1. One model call per step. No in-memory tool loop. (Episode 1)
2. Normalize the provider at one door. (Episode 2)
3. Record the fact before anyone acts. (Episode 3)
4. Admission is not execution. (Episode 4)
5. Continuation is read from the record. (Episode 5)
6. Validate at the boundary, and bound every output. (Episodes 6 and 7)
7. A decline never reaches model context. (Episode 13)
8. Decide retry, continue, or recover from the taxonomy. (Episode 14)
9. Compact to a summary plus the newest exchange. (Episode 15)
10. One execution per session. (Episode 16)

## Deliverables per episode

```
podcast/
  scripts/epNN.md            the read-aloud script
  beats/epNN.md              the beat sheet the script was written from
  companion/epNN.md          show notes: code, paths, prompts, diagrams, sources
```

The script is the only file that is fed to the speech engine. Everything else is for humans.

## Production conventions

- **Stage directions live in square brackets** on their own line, for example `[music out]`
  or `[pause]`. They are stripped before text-to-speech and are never spoken.
- **A speaker turn starts with a label line**: `HOST:`, `CO-HOST:`, or `EXPERT:`, alone on
  its line. The spoken text begins on the next line and runs until the next label line or
  stage direction.
- One speaker per turn. No two speakers in one turn.
- Blank line between turns.
- Everything else in the script is spoken text.

## Quality gates

Before an episode is published:

1. **Factual.** Every claim maps to a topic in the written material. The companion's
   sources list is the audit trail.
2. **Terminology.** Passes the "do not say" list in Appendix E and the style guide.
3. **Read-aloud.** Read the whole script aloud once. Anything you stumble on is rewritten.
4. **Timing.** Word count within the range, and the artifact read under 120 words.
5. **TTS.** No symbols, no markdown, no paths, and no unlisted acronyms in spoken lines.
