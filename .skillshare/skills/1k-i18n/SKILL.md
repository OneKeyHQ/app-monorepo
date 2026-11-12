---
name: 1k-i18n
description: OneKey i18n workflow for module copy, full-language translation create/update, bilingual previews and confirmed writes to OneKeyHQ/onekey-i18n, then pull and verification. Never edit generated translations.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# OneKey i18n

App translations live in [OneKeyHQ/onekey-i18n](https://github.com/OneKeyHQ/onekey-i18n)
(`projects/app`). Copy changes are PRs there; this repository pulls the generated
files from its releases. Use repository scripts for scanning, merging, previews,
writes and verification. The model selects scope, judges reuse, writes copy and translates.

## Rules

- Never manually edit generated locale JSON, `translations.ts`, `localeJsonMap.ts`
  or `i18n.lock.json`. `yarn i18n:check-lock` fails on hand edits.
- Before writing or reviewing English source copy, read
  `.skillshare/skills/ui-copy/SKILL.md` and follow its rules.
- Runtime translations come from bundled locale JSON (`localeLoaders.ts`). Deleting
  a key leaves released app bundles unchanged; later pulls and builds receive it.
- Prefer existing generic keys when meaning, placeholders, capitalization and UI role
  match. Do not duplicate legacy keys for naming consistency or change shared copy
  unless explicitly in scope.
- Translate every locale listed in the draft; preserve ICU placeholders/tags and
  product tone. Do not use English as a placeholder for untranslated languages.
- Use compact summaries, local search and relevant source slices; do not load entire
  locale catalogs. Review dynamic expressions and imported copy the scanner cannot resolve.

| Mode                 | Missing key or empty/whitespace translation | Existing non-empty translation        |
| -------------------- | ------------------------------------------- | ------------------------------------- |
| `complete` (default) | Create or fill                              | Preserve                              |
| `update`             | Create or fill                              | May update within the requested scope |

Both modes use `upsert`. Do not silently switch modes to bypass a rejected overwrite.

## Setup

- A checkout of `OneKeyHQ/onekey-i18n` next to this repository (`../onekey-i18n`),
  or `ONEKEY_I18N_DIR` pointing at one. No Lokalise token or credential wrapper is used.
- `gh auth login` with access to `OneKeyHQ/onekey-i18n` for release pulls.

## Workflow

Paths are relative to the repository root; use `.tmp/i18n/<task>/` for `<dir>`.

1. **Prepare onekey-i18n**: start a branch from its latest `main`, e.g.
   `git -C ../onekey-i18n fetch origin && git -C ../onekey-i18n switch -c i18n/<topic> origin/main`.
   Apply refuses to write on `main`.
2. **Pull before selecting or translating copy**, in both modes:
   `yarn i18n:sync --project-name "Monorepo v5" --out <dir>/sync.json`.
   It pulls from the onekey-i18n checkout. Verify the returned project
   (`OneKeyHQ/onekey-i18n/app`). Preserve unknown local generated changes if the
   script blocks; use [recovery guidance](references/rules/i18n.md#recovery).
3. Locate the module with `rg`, then run
   `yarn i18n:workflow scan --mode <mode> --sync <dir>/sync.json --module <path> --out <dir>/draft.json`.
   Repeat `--module` for related copy. For explicit updates to already complete keys,
   add `--include-complete` and limit edits to the requested keys/languages.
4. Read `draft.json.summary.json` and relevant code. Search reusable keys with
   `yarn i18n:search`. Choose `upsert`/reuse or `ignore` (with a reason); fill missing
   or requested translations using [the patch format](references/rules/i18n.md#fill-a-draft).
   Use `inspect --file <draft>` to check remaining work.
5. Generate a plan with a new filename:
   `yarn i18n:plan --file <dir>/draft.json --project-name "Monorepo v5" --out <dir>/plan.json`.
   Scripts generate JSON, Markdown and HTML; never write one-off preview HTML.
6. **Paste the generated Markdown into the conversation**, provide the HTML link,
   state mode/change scope, and wait for confirmation. Markdown shows only English
   and Simplified Chinese, including old → new wording for updates:

   | Key  | Copy         |
   | ---- | ------------ |
   | key1 | English text |
   |      | 中文文案     |

   If the user returns HTML feedback, follow [feedback import](references/interactive-review.md).
   Edits/comments request a revision, not write approval. Changes to copy, scope,
   mode or baseline require a new preview and confirmation.

7. After confirmation, run
   `yarn i18n:apply --file <dir>/plan.json --approve <confirmed-hash>`.
   This writes every locale into the onekey-i18n checkout, pulls the generated files
   from it and verifies them. Check the receipt and full generated diff, including
   unrelated changes; use recovery guidance if interrupted.
8. **Open the onekey-i18n PR**: in the checkout run `npm run check -- app`, commit
   (`feat: ...` / `fix: ...`), push and `gh pr create`. Its CI and one reviewer gate the merge.
9. Wire generated keys into the requested module, rescan and run appropriate checks.
   Until the onekey-i18n PR merges, `i18n.lock.json` records a local source and this
   repository's PR must not merge. After it merges and its release is published, run
   `yarn i18n:pull` (latest release) and `yarn i18n:check-lock`, then commit the files.
   Report the onekey-i18n PR, locale count, pull verification, unrelated generated
   changes and code wiring. A prepared preview is not a completed write.
10. If keys changed, preserve the old → new mapping. After apply, pull verification
    and code migration succeed, prepare the [old-key cleanup](references/rules/i18n.md#old-key-cleanup)
    list and ask whether to delete it. Translation confirmation does not authorize
    deletion; keep old keys unless the user explicitly approves that deletion scope.

## Code usage

New keys use `semantic_key__title`, `__action`, `__desc` or `__msg` (backend error
identifiers keep `error__service_*_error`); onekey-i18n enforces the same pattern.
Legacy mapping: stored `global::contact_us` → JSON `global.contact_us` → enum
`ETranslations.global_contact_us`.

Use `useIntl().formatMessage({ id: ETranslations.some_key })` during React rendering,
or `appLocale.intl` at call time outside React. Do not cache translated text in
module-level constants; keep memo/callback dependencies responsive to locale changes.

For `yarn i18n:add` compatibility, see [single-key commands](references/rules/i18n.md#single-key-commands).
