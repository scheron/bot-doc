# Automated documentation translation

Changes merged to `master` under `assets/ru/**/*.md` or `assets/ru/**/*.mdx` start the translation workflow. It updates the corresponding files under `assets/en`, validates frontmatter and local links, builds the VuePress site, and opens a separate pull request for review.

## Repository setup

1. Add an Actions secret named `OPENAI_API_KEY` in **Settings → Secrets and variables → Actions**.
2. Optionally add the Actions variable `OPENAI_TRANSLATION_MODEL`. If omitted, the workflow uses `gpt-5-mini`.
3. In **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create and approve pull requests. The workflow itself requests only `contents: write` and `pull-requests: write`.

The workflow uses the built-in `GITHUB_TOKEN`; no personal access token is required.

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
