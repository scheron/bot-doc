# Translation pipeline

## Environment variables

Two roles read the LLM configuration independently: **translation** (turning
a Russian section into English) and **glossary** (classifying terms found by
the term miner). Each role picks its own vendor and model; switching either
one is two environment variables, and it does not affect the other role.

- `TRANSLATION_API_KEY` — the only API key. One key serves both roles.
  **It is an OpenAI-compatible API key, not necessarily a key from OpenAI the
  company.** Every provider in `api/` — DeepSeek included — talks to its
  vendor over the same OpenAI-shaped chat-completions wire format, and this
  variable is named after that shape, not after any one vendor.
- `TRANSLATION_PROVIDER` — which class from the registry to use for
  translation. One of `deepseek`, `openai`. Defaults to `deepseek`.
- `TRANSLATION_MODEL` — which model to ask that provider for. Defaults to
  the provider class's own `DEFAULT_MODEL`.
- `GLOSSARY_PROVIDER` — which class to use for glossary classification. Not
  set? It falls back to `TRANSLATION_PROVIDER`, so term mining works in an
  environment that was only ever set up for translation.
- `GLOSSARY_MODEL` — same fallback rule, onto `TRANSLATION_MODEL`.

Adding a vendor that is not yet in the registry means writing one class in
`api/`, modelled on `deepseek.mjs` or `openai.mjs`, and adding it to the
`PROVIDERS` map in `api/index.mjs`. Nothing else changes.
