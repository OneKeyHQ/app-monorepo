# Highlight Address Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable `HighlightAddress` component that visually emphasizes the first 6 and last 6 characters of a wallet address, and integrate it into the ReceiveToken page.

**Architecture:** A single React component in `packages/kit/src/components/HighlightAddress/` that splits an address string into 3 segments (leading, middle, trailing) and renders each with distinct font weight and color. The leading/trailing segments use `$monoMedium` font + `$text` color, the middle uses `$monoRegular` + `$textSubdued`. Integration is a targeted replacement in ReceiveToken's `renderAddress`.

**Tech Stack:** React, TypeScript, Tamagui (SizableText, XStack), GeistMono fonts

---

### Task 1: Create HighlightAddress Component

**Files:**
- Create: `packages/kit/src/components/HighlightAddress/index.tsx`

**Step 1: Create the component file**

```tsx
import { useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';

type IHighlightAddressProps = {
  address: string;
  leadingHighlightCount?: number;
  trailingHighlightCount?: number;
  groupSize?: number;
};

function groupChars(str: string, size: number): string {
  return str.match(new RegExp(`.{1,${size}}`, 'g'))?.join(' ') ?? str;
}

function HighlightAddress({
  address,
  leadingHighlightCount = 6,
  trailingHighlightCount = 6,
  groupSize = 4,
}: IHighlightAddressProps) {
  const segments = useMemo(() => {
    const minLength = leadingHighlightCount + trailingHighlightCount;
    if (address.length <= minLength) {
      // Address too short to split — render all as highlighted
      return [{ text: groupChars(address, groupSize), highlight: true }];
    }
    const leading = address.slice(0, leadingHighlightCount);
    const middle = address.slice(leadingHighlightCount, -trailingHighlightCount);
    const trailing = address.slice(-trailingHighlightCount);
    return [
      { text: groupChars(leading, groupSize), highlight: true },
      { text: groupChars(middle, groupSize), highlight: false },
      { text: groupChars(trailing, groupSize), highlight: true },
    ];
  }, [address, leadingHighlightCount, trailingHighlightCount, groupSize]);

  return (
    <>
      {segments.map((segment, index) => (
        <SizableText
          key={index}
          fontFamily={segment.highlight ? '$monoMedium' : '$monoRegular'}
          color={segment.highlight ? '$text' : '$textSubdued'}
        >
          {segment.text}
          {index < segments.length - 1 ? ' ' : ''}
        </SizableText>
      ))}
    </>
  );
}

export { HighlightAddress };
export type { IHighlightAddressProps };
```

**Step 2: Verify TypeScript compilation**

Run: `cd /Users/leon/Documents/onekey/x-app-monorepo && npx tsc --noEmit --project packages/kit/tsconfig.json 2>&1 | head -30`
Expected: No errors related to HighlightAddress

**Step 3: Commit**

```bash
git add packages/kit/src/components/HighlightAddress/index.tsx
git commit -m "feat: add HighlightAddress reusable component"
```

---

### Task 2: Integrate into ReceiveToken Page

**Files:**
- Modify: `packages/kit/src/views/Receive/pages/ReceiveToken.tsx:546-599`

**Step 1: Add import**

At the top of `ReceiveToken.tsx`, add import for the new component. Find the existing component imports block (around line 9-23) and add after it:

```tsx
import { HighlightAddress } from '../../../components/HighlightAddress';
```

**Step 2: Modify renderAddress to use HighlightAddress**

Replace the current `renderAddress` callback (lines 546-599) with:

```tsx
const renderAddress = useCallback(() => {
  if (!currentAccount || !network || !wallet) return null;
  if (!displayAddress) return null;

  let addressContent: React.ReactNode;

  if (shouldShowAddress) {
    addressContent = <HighlightAddress address={displayAddress} />;
  } else {
    const maskedText = Array.from({ length: 11 })
      .map(() => '****')
      .join(' ');
    addressContent = (
      <SizableText fontFamily="$monoMedium">{maskedText}</SizableText>
    );
  }

  return (
    <XStack
      flex={platformEnv.isNative ? 1 : undefined}
      maxWidth={platformEnv.isNative ? undefined : 304}
      flexWrap="wrap"
      {...(shouldShowAddress && {
        onPress: handleCopyAddress,
        userSelect: 'none',
        py: '$1',
        px: '$2',
        mx: '$-2',
        my: '$-1',
        borderRadius: '$2',
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
        focusable: true,
        focusVisibleStyle: {
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineOffset: 2,
          outlineStyle: 'solid',
        },
      })}
    >
      {addressContent}
    </XStack>
  );
}, [
  currentAccount,
  displayAddress,
  network,
  wallet,
  shouldShowAddress,
  handleCopyAddress,
]);
```

**Step 3: Verify TypeScript compilation**

Run: `cd /Users/leon/Documents/onekey/x-app-monorepo && npx tsc --noEmit --project packages/kit/tsconfig.json 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/kit/src/views/Receive/pages/ReceiveToken.tsx
git commit -m "feat: integrate HighlightAddress into ReceiveToken page"
```

---

### Task 3: Visual Verification

**Step 1: Start the app**

Run the app on the target platform (mobile or web) and navigate to the Receive Token page.

**Step 2: Verify visual behavior**

Check these scenarios:
- EVM address (long, starts with 0x): first 6 chars and last 6 chars appear in medium weight + primary color, middle is regular weight + subdued color
- Short address (<=12 chars): entire address renders in highlighted style
- Hidden/masked state: `****` blocks display normally with no highlight logic
- Address wrapping: on narrow screens, the address wraps correctly across lines
- Copy: tapping the address still copies the full address to clipboard

**Step 3: Commit any adjustments if needed**

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create HighlightAddress component | `packages/kit/src/components/HighlightAddress/index.tsx` (create) |
| 2 | Integrate into ReceiveToken | `packages/kit/src/views/Receive/pages/ReceiveToken.tsx` (modify) |
| 3 | Visual verification | Manual testing |
