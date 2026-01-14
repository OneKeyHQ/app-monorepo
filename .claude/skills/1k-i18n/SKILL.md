---
name: 1k-i18n
description: Internationalization and translation guidelines for OneKey. Use when adding text strings, using translations, or working with locales. Triggers on i18n, translation, locale, intl, formatMessage, ETranslations, language, text.
allowed-tools: Read, Grep, Glob, Bash
---

# OneKey Internationalization (i18n) Guidelines

## Translation Management - CRITICAL RESTRICTIONS

**ABSOLUTELY FORBIDDEN** (These files are AUTO-GENERATED):
- ❌ **NEVER** modify `@onekeyhq/shared/src/locale/enum/translations.ts` - Will be overwritten and break i18n system
- ❌ **NEVER** modify locale JSON files in `@onekeyhq/shared/src/locale/json/*` - Managed by external translation system
- ❌ **NEVER** hardcode text strings in components - ALWAYS use translation keys
- ❌ **NEVER** add translation keys directly to enum files - Use proper workflow

**CONSEQUENCES OF VIOLATION**:
- Translation system corruption
- Loss of translation work
- Build failures in i18n pipeline
- Breaking localization for international users

## Using Translations
- Use `useFormatMessage` or `formatMessage` functions for displaying translated text
- Define new translation keys in the appropriate modules
- Always use translation keys instead of hardcoding text strings
- Follow the established pattern for translation keys: `namespace__action_or_description`

## Updating Translation Keys
1. **Direct translation from design specs**: Update i18n directly based on design spec annotations without searching existing translation keys
2. Run `yarn fetch:locale` to pull the latest translation keys from the remote system
3. This command automatically updates `@onekeyhq/shared/src/locale/enum/translations.ts` with new translation enums
4. For design spec translation keys like `prime::restore_purchases`, convert to code format:
   - Replace `::` with `_` (underscore)
   - Use the enum: `ETranslations.prime_restore_purchases`
   - In component code:
     ```tsx
     {intl.formatMessage({
       id: ETranslations.prime_restore_purchases,
     })}
     ```

## Locale Handling
- The system uses automatic locale detection with fallbacks
- Default locale fallback chain is implemented in `getDefaultLocale.ts`
- Respect platform-specific locale handling (web, native, desktop, extension)

## Code Examples

### Using Translations in Components
```tsx
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function MyComponent() {
  const intl = useIntl();

  return (
    <SizableText>
      {intl.formatMessage({
        id: ETranslations.global__confirm,
      })}
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

### Translation Key Naming Pattern
```
namespace__action_description

Examples:
- global__confirm
- global__cancel
- swap__select_token
- wallet__create_wallet
- settings__dark_mode
```
