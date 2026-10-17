# Script style guide — spoken register

How to write the lines. The format spec says what each episode contains; this file says how
the sentences are built. It is written for a text-to-speech engine reading the script, so the
rules are stricter than prose rules.

## The one rule

**Write for the ear, not the eye.** Every sentence is heard once, in order, with no ability
to go back. If a listener has to hold two clauses in mind to finish a sentence, the sentence
is wrong.

## Sentences

- Target twelve to twenty words. Hard ceiling around twenty-five.
- One idea per sentence. If a sentence has two ideas, it is two sentences.
- Prefer a period to a dash. Do not use semicolons. Do not use parentheses.
- Do not use a colon to introduce a list in spoken text. Say "here are three" and then speak
  them.
- Start sentences with the subject where you can. Sentences that begin with a long
  subordinate clause lose the listener before the point arrives.
- Vary length deliberately. A run of short sentences is fine. One long sentence among short
  ones lands hard.

## Punctuation for pacing

The engine turns punctuation into prosody, so punctuation is the only direction you get.

- **Period.** A full stop, use it liberally.
- **Comma.** A short breath. Do not use three in a row; that is a run-on with commas.
- **Em dash.** A spoken aside, used sparingly. If in doubt, use a period.
- **Question mark.** Only for real questions. Rhetorical questions still need one, because
  the engine drops pitch at the end.
- **Ellipsis.** Do not use it in spoken text. It produces unreliable pauses and the engine
  may read it. Write a period and, if you need a beat, a stage direction.
- **Quotation marks.** Only around an artifact being read verbatim, and always announced
  first.

## Numbers, symbols, and units

Text-to-speech reads digits badly and inconsistently, so digits do not appear in spoken
lines.

- Spell out all numbers. "five", "twenty-five", "one hundred and twenty".
- Avoid precise large numbers. "a few thousand lines" beats "three thousand four hundred".
  If a number matters, say it, then move on.
- Never write a symbol that would be spoken: no `→`, no `#`, no `§`, no `%` (say "percent"),
  no `+` (say "plus").
- Version numbers: say "version two", not "two point zero point thirty one".

## Identifiers, code, and paths

The material is full of code. Audio carries almost none of it.

- **Never read code aloud.** Describe what it does. "The loop keeps the tool list on the
  final step, and here is why" is a line. `toolChoice: "none"` is not.
- **Translate every identifier into words.**
  - camelCase: `runStep` becomes "the run step function".
  - Dotted names: `Tool.Service` becomes "the tool service".
  - Table and column names: `session_inbox` becomes "the session inbox table".
  - Flags and fields: `codemode: false` becomes "opting a tool out of code mode".
- **Never read a file path.** Say "the runner" or "the agent loop file" and put the path in
  the companion.
- **Never read a diagram label.** Do not say "D two" or "figure two". Say "this picture" and
  put the diagram in the companion.

## Acronyms and names

- Say an acronym letter by letter, with spaces, the first time: "large language model, L L
  M". After that, "L L M".
- Use the pronunciation sheet in `assets/pronunciation.md` for anything that is not obvious.
  If a term is not on the sheet and you are not certain how the engine will say it, do not
  use it in a spoken line.
- Product names: "opencode" is spoken "open code". The companion carries the exact styling.

## Homographs to avoid

These read fine and sound wrong. Rewrite.

| Written | Sounds like | Write instead |
|---|---|---|
| read (past) | reed | "read out", "looked at", "went through" |
| record (noun) | re-CORD | "the written record", "what was written down" |
| live (adjective) | liv | "running", "up to date" |
| object (verb) | OB-ject | "push back", "disagree" |
| lead (metal or verb) | led | "leads" or "guidance", whichever is meant |
| close (near) | cloze | "near" |
| wound (injury) | wownd | "damage" |

## When to read an artifact aloud

The artifact segment reads one real thing, verbatim: usually a prompt, sometimes a project
rule or a list of fields.

- **Announce it.** "Here is the prompt, word for word." Then read.
- **Read it clean.** No commentary inside the quote. No "and I quote" mid-sentence.
- **Keep it under about 120 words.** If it is longer, read the load-bearing part, then say
  the rest is in the companion.
- **Interpret afterwards, not during.** One line of reaction from `CO-HOST`, then `HOST`
  explains what the wording buys.
- **Do not paraphrase a prompt and call it a quote.** Either read it exactly or describe it
  and say clearly that you are describing it.

## The two-host dynamic

- `CO-HOST` asks the question the audience has. Not a strawman, and not a setup for a
  punchline. A real question with a real cost.
- `CO-HOST` pushes back once per beat. More than once becomes bickering.
- Keep turns short. Sixty words is a comfortable turn. Longer than that, the other host
  should take over. The exception is the "how it is actually done" move, where one host may
  hold the floor for a longer explanation.
- Do not have one host explain and the other only say "right" and "exactly".
- Write disagreement as content, not as conflict. The co-host is wrong in a way the audience
  is also wrong, and the correction is the teaching.

## The expert

- At most once per episode.
- Introduce with a plain sentence: "This is the part where the choice looks wrong, so here
  is the person who made it."
- Two to four turns. In, one counterintuitive point, out.
- Speaks in the first person plural about the implementation: "we chose", "we keep".
- Never argues with the co-host. Explains.

## Terminology discipline

These are correctness rules for the show, not preferences. The written material uses the
same terms with the same meanings, and Appendix D is the authority.

- **step** is one model call. Never call a step a "turn".
- **turn** is the whole stretch from taking input until the session would go idle. Use it
  rarely.
- **execution** is one busy period for a session. Not a synonym for step.
- **steer** changes work in progress. **queue** starts new work. Never swap them.
- **compaction** is the act. A **checkpoint** is what it leaves behind. Do not use them
  interchangeably.
- **admission** is recording that work exists. **execution** is running it. Keep them apart.
- **snapshot** is the captured state of the files. A **diff** is the change between two.

### Do not say on air

From the material's own list, plus house style:

- "just", "simply", "obviously", "basically", "at the end of the day"
- "as we saw in the documentation", "in Part three", "Appendix two", "this figure"
- "leverage", "utilize", "in order to" (say "to")
- "it's worth noting", "needless to say"
- "we'll circle back", "deep dive" (unless it is genuinely about depth)

## Precision without pedantry

State the design as a decision, not as trivia.

- Wrong: "The implementation uses a tagged union with three cases."
- Right: "There are exactly three ways out of the loop, and the code names them, so a
  caller cannot forget one."

## Accuracy

Every factual claim traces to a topic in the written material. When a script states a rule,
it is restating an invariant the code actually holds. Do not add plausible detail. If a
number is not in the material, do not invent one. If a listener could check a claim against
the code, the claim must survive the check.

## What a finished script sounds like

- A listener who has never built an agent understands the idea.
- A listener who has built one learns the specific decision they got wrong.
- Nothing is read aloud that only makes sense on a page.
- Read end to end, no sentence causes a stumble.
