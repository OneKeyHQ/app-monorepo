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

1. **Design provides translation key** like `prime::restore_purchases`
2. **Run sync command**: `yarn fetch:locale`
3. **Convert key format**: `prime::restore_purchases` → `ETranslations.prime_restore_purchases`
4. **Use in code**:
   ```tsx
   {intl.formatMessage({ id: ETranslations.prime_restore_purchases })}
   ```

## Translation Key Naming Pattern

```
namespace__action_description

Examples:
- global__confirm
- global__cancel
- swap__select_token
- wallet__create_wallet
- settings__dark_mode
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
