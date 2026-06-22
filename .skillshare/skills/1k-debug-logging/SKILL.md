---
name: 1k-debug-logging
description: Standardize temporary debug console logs in OneKey code with a consistent prefix and safe stringify helper. Use when adding, reviewing, or cleaning local debug logs, temporary console.log output, debug helpers, or troubleshooting-only logging. Do not use for analytics, server logs, LogToServer, or permanent business metrics.
allowed-tools: Read, Grep, Glob, Bash
---

# OneKey Debug Logging

Use this skill for temporary local debug logs. Keep the convention to one filterable prefix and one safe stringify helper.

## Pattern

Create one local helper near the debug area. Rename the prefix and exported helper for the domain:

```typescript
const LOG_PREFIX = '[MKT-TAB]';

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function debugMarketTabsLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}
```

Use the helper at call sites instead of raw `console.log`:

```typescript
debugMarketTabsLog('tab-change', {
  activeTab,
  itemCount: items.length,
});
```

## Rules

- Do not scatter raw `console.log`; keep it inside the helper.
- Keep the helper no-op in production.
- Keep labels short and stable so logs can be filtered.
- Prefer counts, IDs already visible in the UI, booleans, and small scalar state over dumping objects.
- Do not log secrets, private keys, mnemonics, wallet identifiers, full arrays, full watchlists, or full request payloads.
- Remove temporary debug helpers and call sites before shipping unless the user explicitly asks to keep them.

## Related Skills

- `/1k-analytics` - Use for server analytics and permanent business metrics instead of temporary debug logs.
- `/1k-code-quality` - Use when lint or type checks are part of the cleanup.
