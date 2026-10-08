---
name: 1k-i18n
description: OneKey i18n and Lokalise workflow for module copy, full-language translation create/update, bilingual previews, confirmed upload, pull, and verification. Never edit generated translations.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# OneKey i18n

Use repository scripts for scanning, merging, previews, upload and verification.
The model selects scope, judges reuse, writes copy and translates.

## Rules

- Never manually edit generated locale JSON, `translations.ts` or `localeJsonMap.ts`.
- Runtime translations come from bundled locale JSON (`localeLoaders.ts`), not live
  Lokalise requests. Remote deletion leaves existing released app bundles unchanged;
  subsequent pulls and builds receive the deletion.
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

## Workflow

Paths are relative to the repository root; use `.tmp/i18n/<task>/` for `<dir>`.
For `<wrapper>`, use the configured `op` (default), `keychain` or `oenv`.
If one wrapper is unavailable, check the other installed/configured wrappers
before asking the user to sign in or change credentials; do not configure a new
account on their behalf.
**In Codex, oenv requires approved execution outside the sandbox.** A sandbox
signature error does not authorize bypassing signature checks or reinstalling the app.
Never print credentials.
Credential loading and remote sync can be silent for tens of seconds. Poll a
running command and allow at least three minutes before diagnosing a timeout;
silence alone is not evidence of missing credentials or an authorization dialog.
An explicit error or user cancellation can stop the wait earlier. Keep the user
informed while waiting, and inspect the process/receipt before retrying a command.

1. **Pull before selecting or translating copy**, in both modes:
   `yarn <wrapper> yarn i18n:workflow sync --project-name "Monorepo v5" --out <dir>/sync.json`.
   Verify the returned project name/ID. Preserve unknown local generated changes
   if the script blocks; use [recovery guidance](references/rules/i18n.md#recovery).
2. Locate the module with `rg`, then run
   `yarn i18n:workflow scan --mode <mode> --sync <dir>/sync.json --module <path> --out <dir>/draft.json`.
   Repeat `--module` for related copy. For explicit updates to already complete keys,
   add `--include-complete` and limit edits to the requested keys/languages.
3. Read `draft.json.summary.json` and relevant code. Search reusable keys with
   `yarn i18n:search`. Choose `upsert`/reuse or `ignore` (with a reason); fill missing
   or requested translations using [the patch format](references/rules/i18n.md#fill-a-draft).
   Use `inspect --file <draft>` to check remaining work.
4. Generate a plan with a new filename:
   `yarn <wrapper> yarn i18n:workflow preview --file <dir>/draft.json --project-name "Monorepo v5" --out <dir>/plan.json`.
   Scripts generate JSON, Markdown and HTML; never write one-off preview HTML.
5. **Paste the generated Markdown into the conversation**, provide the HTML link,
   state mode/change scope, and wait for confirmation. Markdown shows only English
   and Simplified Chinese, including old → new wording for updates:

   | Key  | Copy         |
   | ---- | ------------ |
   | key1 | English text |
   |      | 中文文案     |

   If the user returns HTML feedback, follow [feedback import](references/interactive-review.md).
   Edits/comments request a revision, not upload approval. Changes to copy, scope,
   mode or remote baseline require a new preview and confirmation.

6. After confirmation, run
   `yarn <wrapper> yarn i18n:workflow apply --file <dir>/plan.json --approve <confirmed-hash>`.
   This uploads, pulls and verifies. Check the receipt and full generated diff,
   including unrelated remote changes; use recovery guidance if interrupted.
7. Wire generated keys into the requested module, rescan and run appropriate checks.
   Report project, locale count, upload/pull verification, unrelated generated changes
   and code wiring. A prepared preview is not a completed upload.
8. If keys changed, preserve the old → new mapping. After apply, pull verification
   and code migration succeed, prepare the [old-key cleanup](references/rules/i18n.md#old-key-cleanup)
   list and ask whether to delete it. Translation confirmation does not authorize
   deletion; keep old keys unless the user explicitly approves that deletion scope.

## Code usage

New keys use `semantic_key__title`, `__action`, `__desc` or `__msg`.
Legacy mapping: remote `global::contact_us` → JSON `global.contact_us` → enum
`ETranslations.global_contact_us`.

Use `useIntl().formatMessage({ id: ETranslations.some_key })` during React rendering,
or `appLocale.intl` at call time outside React. Do not cache translated text in
module-level constants; keep memo/callback dependencies responsive to locale changes.

For `yarn i18n:add` compatibility, see [single-key commands](references/rules/i18n.md#single-key-commands).
