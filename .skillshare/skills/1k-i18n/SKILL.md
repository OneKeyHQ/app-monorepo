---
name: 1k-i18n
description: OneKey i18n and Lokalise workflow for searching, adding, updating, pulling, and using translation keys. Verify the target project and full locale coverage; never edit generated translation files.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Internationalization (i18n)

Guidelines for internationalization and translation management in OneKey.

## Critical Restrictions

**ABSOLUTELY FORBIDDEN** (auto-generated files):
```typescript
// ❌ NEVER modify these files - they are AUTO-GENERATED
// @onekeyhq/shared/src/locale/enum/translations.ts
// @onekeyhq/shared/src/locale/json/*.json

// ❌ NEVER hardcode text strings
<Text>Confirm</Text>

// ✅ CORRECT - Always use translation keys
import { ETranslations } from '@onekeyhq/shared/src/locale';
intl.formatMessage({ id: ETranslations.global__confirm })
```

**Consequences of violation:**
- Translation system corruption
- Loss of translation work
- Build failures in i18n pipeline
- Breaking localization for international users

## Existing Keys First

Search locally and remotely before creating a key. Reuse a key only when its
meaning, placeholders, and UI context match.

For any Lokalise create or update:

- Verify the actual target project name and ID before mutating it.
- Fetch that project's configured languages; do not infer them from an
  environment-variable name.
- Prefer repository scripts and credential wrappers. `yarn op` is the default;
  `keychain` and `oenv` variants are supported alternatives.
- A configured Lokalise MCP or Lokalise Web may be used for an existing
  translation, but the same project and language checks still apply.
- After the remote change, sync locally with `yarn i18n:pull`,
  `yarn i18n:pull:keychain`, or `yarn i18n:pull:oenv`.

## Key Shape Mapping

The same translation may appear in 3 different shapes depending on where you look:

```text
Lokalise / MCP source key:     global::contact_us
Pulled local JSON key:         global.contact_us
Generated enum member:         ETranslations.global_contact_us
```

For newer suffix-style keys, Lokalise and local JSON usually match:

```text
Lokalise / MCP source key:     address_book__action
Pulled local JSON key:         address_book__action
Generated enum member:         ETranslations.address_book__action
```

Query guidance:

- Lokalise / MCP: prefer the exact source key. Legacy namespaced keys often use `::`.
- Local `yarn i18n:search`: searches pulled `en_US.json`, so legacy keys should be queried with `.`, while newer suffix-style keys should be queried with `__`.
- Code usage: refer to the generated `ETranslations` member with `_`.

## End-to-End Delivery Requirements

For any task that creates or updates a translation:

1. Check the current branch and worktree before pulling generated files.
2. Resolve credentials without printing tokens.
3. Retrieve `GET /projects/{project_id}` and confirm the returned project name
   and ID match the intended target.
4. Retrieve `GET /projects/{project_id}/languages` and record its exact
   `lang_iso` values.
5. Search for the exact key in that verified project before creating it.
6. Use `yarn i18n:add` for a missing key. It only creates `en_US` and optional
   `zh_CN` source translations; it does not complete the remaining locales.
7. Ensure the key has valid translations for every checked-in locale. The
   repository currently has 19 locale JSON files.
8. Pull generated files, verify the enum and all locale JSON files, and inspect
   the full generated diff for unrelated remote updates.
9. Wire the generated `ETranslations` member in code and validate placeholder
   consistency.

Do not silently skip a repository locale because the target project uses a
different code format. Map repository locale names to the project's configured
`lang_iso` values. If the project genuinely lacks a required language, stop
before upload and report the mismatch.

The completion report must state the verified project name/ID, covered locale
set, pull command used, generated-file scope, and any unrelated keys brought in
by the pull. Review code changes separately from generated locale changes.

Read [i18n.md](references/rules/i18n.md) before performing any remote Lokalise
mutation or `i18n:pull`. It contains the project preflight, current 19-locale
set, translation-record update flow, and generated-diff verification.

## Quick Reference

### Using Translations in Components
```typescript
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function MyComponent() {
  const intl = useIntl();

  return (
    <SizableText>
      {intl.formatMessage({ id: ETranslations.global__confirm })}
    </SizableText>
  );
}
```

### Using formatMessage Outside Components
```typescript
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const message = appLocale.intl.formatMessage({
  id: ETranslations.global__cancel,
});
```

## Translation Workflow

1. **Search first**
   - Local search: `yarn i18n:search "global.contact_us"` or `yarn i18n:search "address_book__action"`
2. **Verify the target** — confirm project name/ID and fetch exact project languages
3. **Search remotely** — query the exact source key, such as `global::contact_us`, in that verified project
4. **If the key already exists, update it in Lokalise** by translation record
5. **If it is a new key, add it via `yarn i18n:add`** using the suffix-style underscore format
6. **Complete every repository locale** — do not stop after `en_US`/`zh_CN`
7. **Pull and inspect** — verify the key everywhere and call out unrelated generated changes
8. **Use in code**:
   ```tsx
   {intl.formatMessage({ id: ETranslations.global_contact_us })}
   ```

## New Key Naming Pattern

```
semantic_key__type

Examples:
- send__title
- confirm_send__action
- enter_send_amount__desc
- transaction_failed__msg
```

## Detailed Guide

For comprehensive i18n guidelines and the end-to-end Lokalise workflow, see
[i18n.md](references/rules/i18n.md).

Topics covered:
- Translation management restrictions
- Using translations in components
- Translation key naming conventions
- Target project and language verification
- Full 19-locale coverage
- Safe Lokalise create/update and pull flow
- Generated-diff inspection
- Locale handling and fallbacks
- Code examples

## Key Files

| Purpose | File Path |
|---------|-----------|
| Translation enum (auto-generated) | `packages/shared/src/locale/enum/translations.ts` |
| Locale JSON (auto-generated) | `packages/shared/src/locale/json/` |
| App locale | `packages/shared/src/locale/appLocale.ts` |
| Default locale | `packages/shared/src/locale/getDefaultLocale.ts` |
| Lokalise add script | `development/scripts/i18n/i18n-add.js` |
| Lokalise pull script | `development/scripts/i18n/i18n-pull.js` |

## Related Skills

- `/1k-coding-patterns` - Date formatting with locale support
- `/1k-coding-patterns` - General coding patterns
