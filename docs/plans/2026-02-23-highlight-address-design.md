# Highlight Address Design

## Overview

Create a reusable `HighlightAddress` component that visually emphasizes the first 6 and last 6 characters of a wallet address using bold text and distinct color. This improves address verification UX by drawing the user's eye to the most security-relevant parts of an address.

## Motivation

On the ReceiveToken page, addresses are currently displayed as plain monospace text grouped in 4-character segments. Users must manually scan the full address to verify correctness. Highlighting the leading and trailing characters — the segments most commonly checked — reduces cognitive load and improves security.

## Component Design

### Location

`packages/kit/src/components/HighlightAddress/index.tsx`

### Props

```typescript
interface IHighlightAddressProps {
  address: string;                    // Full address string
  leadingHighlightCount?: number;     // Characters to highlight at start (default: 6)
  trailingHighlightCount?: number;    // Characters to highlight at end (default: 6)
  groupSize?: number;                 // Characters per visual group (default: 4)
  highlightStyle?: {                  // Override for highlighted text
    color?: string;                   // Default: $text (primary)
    fontFamily?: string;              // Default: $mono (bold variant)
  };
  normalStyle?: {                     // Override for non-highlighted text
    color?: string;                   // Default: $textSubdued
    fontFamily?: string;              // Default: $monoMedium
  };
}
```

### Rendering Logic

1. Split address into 3 segments: `address.slice(0, 6)`, `address.slice(6, -6)`, `address.slice(-6)`
2. Each segment is independently grouped into 4-character chunks with spaces
3. Leading and trailing segments render with bold font + primary color
4. Middle segment renders with regular font + subdued color
5. Container uses `flexWrap: 'wrap'` for line wrapping

### Visual Example (EVM address)

```
[bold+primary] 0x1A 2B [/bold]  [subdued] 3C4D 5E6F 7890 ... ABCD [/subdued]  [bold+primary] EF12 3456 [/bold]
```

## Integration

### ReceiveToken Page

In `packages/kit/src/views/Receive/pages/ReceiveToken.tsx`, replace the current `renderAddress` text rendering:

**Before:**
```tsx
<SizableText fontFamily="$monoMedium">{addressContent}</SizableText>
```

**After:**
```tsx
{shouldShowAddress ? (
  <HighlightAddress address={displayAddress} />
) : (
  <SizableText fontFamily="$monoMedium">{maskedContent}</SizableText>
)}
```

The masked state (`****`) remains unchanged; highlighting only applies when the address is visible.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Address length <= 12 | No highlight; render all text in normal style |
| Address hidden (masked) | Do not use this component; keep `****` mask |
| 4-char group spans highlight boundary | Each segment groups independently |

## Out of Scope

- Animation effects
- Custom highlight segment count beyond leading/trailing
- Placement in `@onekeyhq/components` (component is business-scoped, belongs in `kit`)
