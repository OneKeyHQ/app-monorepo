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

- Access to `OneKeyHQ/onekey-i18n` through GitHub: `gh auth login`, or a token in
  `ONEKEY_I18N_TOKEN`. No checkout of onekey-i18n, Lokalise token or credential wrapper.

## Workflow

Paths are relative to the repository root; use `.tmp/i18n/<task>/` for `<dir>`.

1. **Pull before selecting or translating copy**, in both modes:
   `yarn i18n:sync --project-name "Monorepo v5" --out <dir>/sync.json`.
   It pulls the latest `app` release. Verify the returned project
   (`OneKeyHQ/onekey-i18n/app`). Preserve unknown local generated changes if the
   script blocks; use [recovery guidance](references/rules/i18n.md#recovery).
2. Locate the module with `rg`, then run
   `yarn i18n:workflow scan --mode <mode> --sync <dir>/sync.json --module <path> --out <dir>/draft.json`.
   Repeat `--module` for related copy. For explicit updates to already complete keys,
   add `--include-complete` and limit edits to the requested keys/languages.
3. Read `draft.json.summary.json` and relevant code. Search reusable keys with
   `yarn i18n:search`. Choose `upsert`/reuse or `ignore` (with a reason); fill missing
   or requested translations using [the patch format](references/rules/i18n.md#fill-a-draft).
   Use `inspect --file <draft>` to check remaining work.
4. Generate a plan with a new filename:
   `yarn i18n:plan --file <dir>/draft.json --project-name "Monorepo v5" --out <dir>/plan.json`.
   Scripts generate JSON, Markdown and HTML; never write one-off preview HTML.
5. **Paste the generated Markdown into the conversation**, provide the HTML link,
   state mode/change scope, and wait for confirmation. Markdown shows only English
   and Simplified Chinese, including old → new wording for updates:

   | Key  | Copy         |
   | ---- | ------------ |
   | key1 | English text |
   |      | 中文文案     |

   If the user returns HTML feedback, follow [feedback import](references/interactive-review.md).
   Edits/comments request a revision, not write approval. Changes to copy, scope,
   mode or baseline require a new preview and confirmation.

6. After confirmation, run
   `yarn i18n:apply --file <dir>/plan.json --approve <confirmed-hash>`.
   It commits every locale to a new onekey-i18n branch through the GitHub API, opens
   the onekey-i18n PR (link in the receipt), waits for that PR's CI preview (about a
   minute or two), pulls it and verifies the generated files. Check the receipt and
   full generated diff, including unrelated changes; use recovery guidance if
   interrupted. A rerun with the same hash reuses the opened PR.
7. The onekey-i18n PR needs its CI and one reviewer. Report its link.
8. Wire generated keys into the requested module, rescan and run appropriate checks.
   Until the onekey-i18n PR merges, `i18n.lock.json` records that PR as the source and
   this repository's PR must not merge. After it merges and its release is published,
   run `yarn i18n:pull` (latest release) and `yarn i18n:check-lock`, then commit the
   files. Report the onekey-i18n PR, locale count, pull verification, unrelated
   generated changes and code wiring. A prepared preview is not a completed write.
9. If keys changed, preserve the old → new mapping. After apply, pull verification
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
