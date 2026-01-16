---
name: 1k-date-formatting
description: Guides proper date and time formatting in OneKey app. Use when displaying dates/times in UI, formatting timestamps, or when dates need to follow app locale settings. Date, time, locale, formatDate, dateUtils.
---

# Date Formatting Skill

This skill ensures consistent date and time formatting across the OneKey app, respecting user locale settings.

## Usage

Use this skill when:
- Displaying dates or times in UI components
- Formatting timestamps from API responses
- Ensuring dates follow the app's language/locale settings
- Converting date strings for display

## Core Rules

### NEVER use native JavaScript date methods

```typescript
// ❌ FORBIDDEN - Does not respect app settings
date.toLocaleDateString()
date.toLocaleString()
date.toISOString()
new Intl.DateTimeFormat().format(date)
```

### ALWAYS use OneKey's date utilities

```typescript
// ✅ CORRECT - Follows app locale settings
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
formatDate(date, { hideSeconds: true });
```

## Available Functions

### From `@onekeyhq/shared/src/utils/dateUtils`

| Function | Description | Example Output |
|----------|-------------|----------------|
| `formatDate(date, options?)` | Full date and time | `2024/01/15, 14:30` |
| `formatTime(date, options?)` | Time only | `14:30:45` |
| `formatRelativeDate(date)` | Relative display | `Today`, `Yesterday`, `2024/01/15` |
| `formatDistanceToNow(date)` | Time distance | `2 days ago`, `5 minutes ago` |
| `formatDateFns(date, format?)` | Custom format | Based on format template |

## Options Reference

```typescript
interface IFormatDateOptions {
  hideYear?: boolean;        // Always hide year
  hideMonth?: boolean;       // Always hide month
  hideTheYear?: boolean;     // Hide year if current year
  hideTheMonth?: boolean;    // Hide month if current month
  hideTimeForever?: boolean; // Hide time portion
  hideSeconds?: boolean;     // Hide seconds (HH:mm instead of HH:mm:ss)
  formatTemplate?: string;   // Custom date-fns format template
}
```

## Format Templates

Common date-fns format tokens:

| Token | Description | Example |
|-------|-------------|---------|
| `yyyy` | 4-digit year | `2024` |
| `LL` | 2-digit month | `01` |
| `dd` | 2-digit day | `15` |
| `HH` | 24-hour hours | `14` |
| `mm` | Minutes | `30` |
| `ss` | Seconds | `45` |
| `PPP` | Full date | `January 15, 2024` |

## Common Patterns

### Transaction/History Lists

```typescript
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

// Standard format, hide seconds
<SizableText>{formatDate(item.createdAt, { hideSeconds: true })}</SizableText>
```

### Smart Year Display

```typescript
// Hide year if it's the current year
<SizableText>
  {formatDate(item.date, { hideTheYear: true, hideSeconds: true })}
</SizableText>
```

### Custom Format

```typescript
// Custom format template
<SizableText>
  {formatDate(item.timestamp, { formatTemplate: 'yyyy-LL-dd HH:mm' })}
</SizableText>
```

### Relative Time

```typescript
import { formatDistanceToNow } from '@onekeyhq/shared/src/utils/dateUtils';

// "2 hours ago", "5 minutes ago"
<SizableText>{formatDistanceToNow(item.updatedAt)}</SizableText>
```

### React Hook (for dynamic updates)

```typescript
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';

function MyComponent() {
  const { formatDate, formatDistanceToNow } = useFormatDate();

  return (
    <SizableText>{formatDate(date, { hideSeconds: true })}</SizableText>
  );
}
```

## Locale-Aware Format

The date utilities automatically detect the app locale and adjust format:

```typescript
// Automatically uses correct format based on locale:
// 'en-US' → 'LL/dd/yyyy, HH:mm:ss' (01/15/2024)
// 'zh-CN' → 'yyyy/LL/dd, HH:mm:ss' (2024/01/15)
// 'de'    → 'LL/dd/yyyy, HH:mm:ss'
```

## Real-World Examples

### Example 1: ReferFriends List

```typescript
// File: packages/kit/src/views/ReferFriends/pages/YourReferred/index.tsx
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

<SizableText size="$bodyMd" color="$textSubdued">
  {item.createdAt
    ? formatDate(item.createdAt, { formatTemplate: 'yyyy-LL-dd HH:mm' })
    : ''}
</SizableText>
```

### Example 2: Transaction History

```typescript
// File: packages/kit/src/components/TxHistoryListView/index.tsx
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

formatDate(new Date(date), {
  hideTheYear: true,
  hideSeconds: true,
})
```

### Example 3: Redemption History

```typescript
// File: packages/kit/src/views/Redemption/pages/RedemptionHistory.tsx
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

<SizableText size="$bodyMd" color="$textSubdued">
  {formatDate(item.redeemedAt, { hideSeconds: true })}
</SizableText>
```

## Key Files

| Purpose | File Path |
|---------|-----------|
| Core utilities | `packages/shared/src/utils/dateUtils.ts` |
| React hook | `packages/kit/src/hooks/useFormatDate.ts` |
| Locale hook | `packages/kit/src/hooks/useLocaleVariant.ts` |
| Locale mapping | `packages/shared/src/locale/dateLocaleMap.ts` |
| App locale | `packages/shared/src/locale/appLocale.ts` |

## Troubleshooting

### Date shows wrong locale

Ensure you're using `@onekeyhq/shared/src/utils/dateUtils` instead of native methods. The utility automatically reads from `appLocale.getLocale()`.

### Need to update when locale changes

Use the `useFormatDate` hook in React components for reactive updates:

```typescript
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';

const { formatDate } = useFormatDate();
// Will re-render when locale changes
```

### Custom format not working

Ensure your format template uses valid date-fns tokens. Common mistake: using `MM` (month with leading zero for parsing) instead of `LL` (month with leading zero for formatting).
