# Pronunciation sheet

How every term is spoken. The speech engine is given the spoken form, not the written form.
`write it` is the spelling that goes into the script.

Rule: if a term is not here and you are not certain how the engine will say it, do not put it
in a spoken line. Add it here first.

## Product and project names

| Term | Say | Write it |
|---|---|---|
| opencode | open code | opencode |
| OpenCode | open code | opencode |
| Effect (the library) | effect | Effect, only in a written reference; otherwise avoid or say "the effect library" |
| LayerNode | layer node | "the layer node type" |

## The agent's own vocabulary

These are the domain terms from the glossary. Most are ordinary English and need nothing
special; the ones that are easy to hear wrong are listed.

| Term | Say | Write it | Note |
|---|---|---|---|
| step | step | a step | One model call. Never "turn". |
| turn | turn | a turn | The whole stretch until idle. Rare on air. |
| execution | ex-e-cu-tion | an execution | One busy period. |
| drain | drain | to drain | The verb the code uses. Fine as is. |
| inbox | in-box | the inbox | |
| admission | ad-mis-sion | admitting work | Prefer "admitting work" over the noun. |
| delivery | de-liv-er-y | delivering | |
| steer | steer | to steer | Like a car. |
| queue | queue | queued | Engine says "Q". Write "queued work" or "waiting" instead of the bare noun. |
| compaction | com-pac-tion | compaction | |
| checkpoint | check-point | a checkpoint | Distinct from compaction. |
| projection | pro-jec-tion | a projection | |
| projector | pro-jec-tor | a projector | The thing that folds events. |
| snapshot | snap-shot | a snapshot | |
| diff | diff | a diff | Engine is fine. |
| revert | re-vert | to revert | |
| session | ses-sion | a session | |
| subagent | sub-a-gent | a subagent | One word, said as "sub agent". |
| codemode | code mode | code mode | Always two words on air. |
| namespace | name-space | a namespace | |

## Acronyms

Say an acronym as letters, with a space, the first time. Spell the full form first.

| Acronym | Say | Write it |
|---|---|---|
| LLM | L L M | "large language model, L L M", then "L L M" |
| AI | A I | "A I", or say "the model" |
| API | A P I | |
| HTTP | H T T P | Prefer "the wire" or "the network" where it fits |
| SSE | S S E | Prefer "the live event feed" |
| URL | U R L | |
| CLI | C L I | Prefer "the command line" |
| TUI | T U I | Prefer "the terminal interface" |
| PID | P I D | Prefer "the process ID" |
| UUID | U U I D | Prefer "an identifier" |
| MCP | M C P | Say the letters, then "the tool protocol" |
| JSON | jason | |
| YAML | yammel | |
| UTF-8 | U T F eight | |
| PTY | P T Y | Prefer "a pseudo terminal" |

## Words that carry a technical meaning

| Term | Say | Write it | Note |
|---|---|---|---|
| schema | skee-ma | "the data shape" | Avoid entirely in speech; the engine may say "she-ma". |
| fiber | fy-ber | a fiber | |
| deferred | de-ferd | a deferred | |
| scope | scope | a scope | |
| layer | layer | a layer | |
| hook | hook | a hook | |
| bus | bus | the bus | |
| prompt | prompt | the prompt | |
| token | to-ken | a token | |
| cache | cash | the cache | |
| cursor | cur-sor | a cursor | |
| payload | pay-load | the payload | |
| retry | ree-try | to retry | Not "retree". |
| parallel | pair-a-lel | parallel | Engine is fine. |
| idempotent | eye-dem-poe-tent | idempotent | |

## Numbers and versions

| Written | Say |
|---|---|
| 2.0.31 | version two |
| 25 minutes | twenty-five minutes |
| 100,000 lines | a hundred thousand lines, or "an enormous amount" |
| 10 percent | ten percent |

## Composed names to avoid on air

Do not say these. Say the description in the third column.

| Code name | Say |
|---|---|
| `llm.stream` | the model stream call |
| `runStep` | the run step function |
| `advanceToStep` | preparing the next step |
| `toolChoice` | whether tools are offered |
| `DrainResult` | the three ways out of the loop |
| `session_inbox` | the session inbox table |
| `Tool.Service` | the tool service |
| `packages/core/src/...` | "the runner", or "the agent loop file" |

## Engine notes

- Gemini TTS handles contractions, commas, and periods well. Use them normally.
- Avoid ellipses in spoken text. The pause is unreliable.
- Avoid all-caps words in spoken lines. Some engines spell them out letter by letter, and
  others shout them.
- Avoid slash notation. "read and write" is better than "read/write", and "per session" is
  better than "session/hour".
- Numbers in a spoken line should always be spelled out. Digits are read inconsistently.
