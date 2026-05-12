---
name: 1k-i18n
description: Internationalization — translations (ETranslations, useIntl, formatMessage) and locale management. NEVER modify auto-generated translation files.
allowed-tools: Read, Grep, Glob
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

When updating an existing translation:

- Do not edit generated locale files directly.
- Update the source translation in Lokalise:
  - Use the `lokalise` MCP if it is available in the current environment.
  - Otherwise use Lokalise Web.
- After the source change, sync locally with `yarn i18n:pull` or `yarn i18n:pull:keychain`.

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
   - Lokalise / MCP: try the exact source key, such as `global::contact_us`
2. **If the key already exists, update it in Lokalise** and then run `yarn i18n:pull`
3. **If it is a new key, add it via `yarn i18n:add`** using the suffix-style underscore format
4. **Use in code**:
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

For comprehensive i18n guidelines and examples, see [i18n.md](references/rules/i18n.md).

Topics covered:
- Translation management restrictions
- Using translations in components
- Translation key naming conventions
- Locale handling and fallbacks
- Code examples
- Workflow summary

## Key Files

| Purpose | File Path |
|---------|-----------|
| Translation enum (auto-generated) | `packages/shared/src/locale/enum/translations.ts` |
| Locale JSON (auto-generated) | `packages/shared/src/locale/json/` |
| App locale | `packages/shared/src/locale/appLocale.ts` |
| Default locale | `packages/shared/src/locale/getDefaultLocale.ts` |

## Related Skills

- `/1k-date-formatting` - Date formatting with locale support
- `/1k-coding-patterns` - General coding patterns
