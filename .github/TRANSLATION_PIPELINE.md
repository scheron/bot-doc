# Automated documentation translation

Changes merged to `master` under `assets/ru/**/*.md` or `assets/ru/**/*.mdx` start the translation workflow. It updates the corresponding files under `assets/en`, validates frontmatter and local links, builds the VuePress site, and opens a separate pull request for review.

## Repository setup

1. Add an Actions secret named `OPENAI_API_KEY` in **Settings → Secrets and variables → Actions**. It holds the key of whichever provider is configured below, not necessarily an OpenAI one.
2. Optionally add the Actions variables `TRANSLATION_PROVIDER` and `TRANSLATION_MODEL`. If omitted, the workflow uses `deepseek` with `deepseek-v4-flash`.

### Changing the provider

`scripts/lib/translation-provider.mjs` holds every provider-specific detail, so switching vendors is configuration rather than code. Three presets ship with it:

| `TRANSLATION_PROVIDER` | Endpoint | Default model |
| --- | --- | --- |
| `deepseek` (default) | `https://api.deepseek.com/chat/completions` | `deepseek-v4-flash` |
| `openai` | `https://api.openai.com/v1/responses` | `gpt-5-mini` |
| `compatible` | set `TRANSLATION_API_URL` yourself | set `TRANSLATION_MODEL` yourself |

Use `compatible` for any other OpenAI-compatible vendor. `TRANSLATION_API_URL`, `TRANSLATION_MODEL`, `TRANSLATION_API_KEY` and `TRANSLATION_MAX_TOKENS` override any preset individually.

Two provider differences the module absorbs. The `openai` preset uses the Responses API, which enforces the reply shape server-side with a strict JSON schema; `deepseek` and `compatible` speak Chat Completions, which only offers `json_object` mode, so the module appends the schema and a worked example to the system prompt instead. DeepSeek also enables thinking mode by default at `high` effort, which buys nothing for translation, so the preset sends `{"thinking": {"type": "disabled"}}`.
3. In **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create and approve pull requests. The workflow itself requests only `contents: write` and `pull-requests: write`.

The workflow uses the built-in `GITHUB_TOKEN`; no personal access token is required.

## Running it by hand

The workflow translates what changed between two commits, but the same script covers one-off work such as filling in a document that has no English version yet.

```bash
yarn translate --base <git-ref> [--head <git-ref>]   # what the workflow runs
yarn translate --files assets/ru/api.md              # translate one document in full
yarn translate --all                                 # translate everything still missing
```

`--files` and `--all` translate a document from scratch and refuse to touch an English file that already exists. Add `--force` when you do want to replace one, and remember that this throws away any hand-editing it has received. `--all` reads the tracked file list, so a new document has to be committed before it is picked up.

Add `--dry-run` to any of these to print the planned work without calling the model. The API key is only read when a translation actually runs, so a dry run needs no credentials.

Only `--base` produces a minimal patch, because only that mode has a Russian diff to work from.

## Translation policy

The editable model prompt is stored in `.github/prompts/translate-docs.md`. It contains the domain terminology and preservation rules separately from the translation script, so it can be reviewed and refined like the documentation itself.

Technical tokens—including text in backticks, parameter and API field names, enum values, identifiers, existing English UI labels and trading terms—must remain verbatim. Add project-specific terms and examples to the prompt as the terminology evolves.

The script also enforces this mechanically for inline-code tokens: every backtick-delimited token introduced by changed Russian lines must appear verbatim in the English result. A violation stops the workflow before a pull request is created.

## Behaviour

- Added source documents are translated in full.
- Modified documents are updated with exact find/replace patches derived from the Russian Git diff. Existing unrelated English text is left untouched.
- Renamed and deleted documents are mirrored under `assets/en` without using the model when no translation is required. A rename that also changes content is patched by the model.
- An ambiguous model patch fails safely instead of making a best-effort replacement.
- A failed validation or site build prevents creation of the translation pull request.

The workflow can also be started manually. `base_ref` controls the Git ref used to find changed Russian documents; when it is empty, `HEAD^` is used.
