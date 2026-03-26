# Market Detail Token Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a token search/switch modal to the Market detail page so users can switch tokens inline without navigating back.

**Architecture:** Atom-driven data with URL sync via `navigation.replace()`. Desktop uses Popover trigger, mobile uses pushModal full-screen. Reuses Market home page data hooks for Favorites/Spot/Futures tabs.

**Tech Stack:** React/React Native, Jotai (contextAtomMethod), React Navigation, FlashList, Tamagui components

---

### Task 1: Add `changeActiveToken` Action

**Files:**
- Modify: `packages/kit/src/states/jotai/contexts/marketV2/actions.ts`

- [ ] **Step 1: Add the `changeActiveToken` method to `ContextJotaiActionsMarketV2`**

In `packages/kit/src/states/jotai/contexts/marketV2/actions.ts`, add after the `clearTokenDetail` method (after line 95):

```typescript
changeActiveToken = contextAtomMethod(
  async (
    _get,
    set,
    payload: { tokenAddress: string; networkId: string; isNative: boolean },
  ) => {
    const { tokenAddress, networkId, isNative } = payload;
    // Clear stale data from previous token
    this.clearTokenDetail.call(set);
    // Set new token identifiers
    this.setTokenAddress.call(set, tokenAddress);
    this.setNetworkId.call(set, networkId);
    this.setIsNative.call(set, isNative);
    // Fetch new token data
    await this.fetchTokenDetail.call(set, tokenAddress, networkId);
  },
);
```

- [ ] **Step 2: Export `changeActiveToken` from `useTokenDetailActions`**

In the same file, add `changeActiveToken` to the `useTokenDetailActions` hook (around line 483):

```typescript
export function useTokenDetailActions() {
  const actions = createActions();
  const setTokenDetail = actions.setTokenDetail.use();
  const setTokenDetailLoading = actions.setTokenDetailLoading.use();
  const setTokenAddress = actions.setTokenAddress.use();
  const setNetworkId = actions.setNetworkId.use();
  const setIsNative = actions.setIsNative.use();
  const setTokenDetailWebsocket = actions.setTokenDetailWebsocket.use();
  const setPerpsInfo = actions.setPerpsInfo.use();
  const fetchTokenDetail = actions.fetchTokenDetail.use();
  const clearTokenDetail = actions.clearTokenDetail.use();
  const changeActiveToken = actions.changeActiveToken.use();

  return useRef({
    setTokenDetail,
    setTokenDetailLoading,
    setTokenAddress,
    setNetworkId,
    setIsNative,
    setTokenDetailWebsocket,
    setPerpsInfo,
    fetchTokenDetail,
    clearTokenDetail,
    changeActiveToken,
  });
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/states/jotai/contexts/marketV2/actions.ts 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add packages/kit/src/states/jotai/contexts/marketV2/actions.ts
git commit -m "feat(market): add changeActiveToken action for inline token switching"
```

---

### Task 2: Add Mobile Token Selector Modal Route

**Files:**
- Modify: `packages/kit/src/views/Market/router/index.tsx`
- Modify: `packages/shared/src/routes/modal.ts` (type only — add to `IModalMarketParamList`)

- [ ] **Step 1: Add `MobileTokenSelector` route enum and param type**

In `packages/kit/src/views/Market/router/index.tsx`, add the new route:

```typescript
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketDetailV2Modal = LazyLoadPage(() => import('../MarketDetailV2'));
const MarketBannerDetailModal = LazyLoadPage(
  () => import('../MarketBannerDetail'),
);
const MobileTokenSelectorModal = LazyLoadPage(
  () =>
    import(
      '../MarketDetailV2/components/TokenSelector/MobileTokenSelector'
    ),
);

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
  MobileTokenSelector = 'MobileTokenSelector',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
  };
  [EModalMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
  [EModalMarketRoutes.MobileTokenSelector]: undefined;
};

export const ModalMarketStack: IModalFlowNavigatorConfig<
  EModalMarketRoutes,
  IModalMarketParamList
>[] = [
  {
    name: EModalMarketRoutes.MarketDetailV2,
    component: MarketDetailV2Modal,
    translationId: ETranslations.dexmarket_details_overview,
  },
  {
    name: EModalMarketRoutes.MarketBannerDetail,
    component: MarketBannerDetailModal,
  },
  {
    name: EModalMarketRoutes.MobileTokenSelector,
    component: MobileTokenSelectorModal,
  },
];
```

- [ ] **Step 2: Update `IModalMarketParamList` in `packages/shared/src/routes/modal.ts`**

The type `IModalMarketParamList` is imported from the router file. Verify the import chain is correct — check that `packages/shared/src/routes/modal.ts` line 104 imports from the Market router. If it imports from a different location, update accordingly.

Run: `grep -n "IModalMarketParamList" packages/shared/src/routes/modal.ts`

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/router/index.tsx 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add packages/kit/src/views/Market/router/index.tsx
git commit -m "feat(market): add MobileTokenSelector modal route"
```

---

### Task 3: Create the Search/Filter Hook

**Files:**
- Create: `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelector.ts`

- [ ] **Step 1: Create the hook file**

This hook manages search query, active tab, and filters. It reuses Market home page data hooks.

```typescript
import { useCallback, useMemo, useRef, useState } from 'react';

import { useDebouncedValue } from '@onekeyhq/kit/src/hooks/useDebouncedValue';

export type IMarketTokenSelectorTab = 'watchlist' | 'spot' | 'futures';

export function useMarketTokenSelector() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<IMarketTokenSelectorTab>('watchlist');

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text.slice(0, 64).trim());
  }, []);

  const handleTabChange = useCallback((tab: IMarketTokenSelectorTab) => {
    setActiveTab(tab);
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    activeTab,
    handleSearchChange,
    handleTabChange,
  };
}
```

**Note:** The exact debounce hook name may differ in this codebase. Check for existing debounce patterns:
Run: `grep -rn "useDebouncedValue\|useDebounce" packages/kit/src/hooks/ --include="*.ts" | head -10`

Adjust the import if needed.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelector.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelector.ts
git commit -m "feat(market): add useMarketTokenSelector hook for search and tab state"
```

---

### Task 4: Create Mobile Token Selector Modal

**Files:**
- Create: `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileTokenSelector.tsx`

- [ ] **Step 1: Create the mobile token selector component**

This is a full-screen Page modal. It mirrors `MoblieTokenSelector.tsx` from Perps but uses Market data sources. The component should:

1. Render a `Page` with a `SearchBar` in the header
2. Show three tabs: Watchlist / Spot / Futures using `ScrollableFilterBar` or equivalent tab component
3. Under each tab, show the corresponding filter (category selector for watchlist/futures, network filter for spot)
4. Render token list using `FlashList` or `ListView`
5. On token selection, call `changeActiveToken` + `navigation.replace` + `navigation.popStack`

Reference the Perps mobile selector at `packages/kit/src/views/Perp/components/TokenSelector/MoblieTokenSelector.tsx` for the Page/SearchBar/Tab layout pattern.

Reference the Market home page's existing list components for data:
- `MobileMarketWatchlistFlatList` for watchlist data
- `MobileMarketTokenFlatList` for spot data
- `MobileMarketPerpsFlatList` for futures data

The key handler:

```typescript
const handleSelectToken = useCallback(
  (params: {
    tokenAddress: string;
    networkId: string;
    network: string;
    isNative: boolean;
  }) => {
    const { tokenAddress, networkId, network, isNative } = params;
    tokenDetailActions.current.changeActiveToken({
      tokenAddress,
      networkId,
      isNative,
    });
    // Sync URL
    appNavigation.replace(ETabMarketRoutes.MarketDetailV2, {
      tokenAddress,
      network,
      isNative,
    });
    // Close modal
    appNavigation.popStack();
  },
  [tokenDetailActions, appNavigation],
);
```

**Important:** The component must be wrapped with `MarketWatchListProviderMirrorV2` (for watchlist context) when exported, similar to how Perps wraps with `PerpsProviderMirror`.

- [ ] **Step 2: Create the default export for lazy loading**

The file must have a default export for `LazyLoadPage` to work:

```typescript
export default function MobileTokenSelectorModal() {
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <MobileTokenSelectorContent />
    </MarketWatchListProviderMirrorV2>
  );
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileTokenSelector.tsx 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileTokenSelector.tsx
git commit -m "feat(market): add mobile token selector modal for Market detail page"
```

---

### Task 5: Create Desktop Token Selector (Popover)

**Files:**
- Create: `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector.tsx`

- [ ] **Step 1: Create the desktop Popover token selector**

This mirrors `PerpTokenSelector.tsx` desktop pattern. The component should:

1. Use `Popover` from `@onekeyhq/components` with `renderTrigger` showing the token icon + symbol + chevron
2. `renderContent` renders a panel (~800px wide) with SearchBar, tabs, filters, and token list
3. On token selection, call `changeActiveToken` + `navigation.replace` + `closePopover()`

Reference the Perps desktop selector at `packages/kit/src/views/Perp/components/TokenSelector/PerpTokenSelector.tsx` for the Popover pattern (lines 580-665).

The trigger element:

```typescript
function MarketTokenSelectorTrigger({
  tokenDetail,
  networkId,
  networkLogoUri,
  isNative,
}: {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  isNative?: boolean;
}) {
  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};
  return (
    <XStack
      gap="$2"
      alignItems="center"
      cursor="pointer"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.6 }}
    >
      <Token
        size="md"
        tokenImageUri={logoUrl}
        tokenImageUris={logoUrls}
        networkImageUri={networkLogoUri}
        fallbackIcon="CryptoCoinOutline"
      />
      <SizableText size="$heading2xl" color="$text" numberOfLines={1}>
        {symbol}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}
```

The Popover content component should reuse the same tab/filter/list structure as the mobile version but in a constrained-height container (similar to Perps desktop at 350px list height).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector.tsx
git commit -m "feat(market): add desktop Popover token selector for Market detail page"
```

---

### Task 6: Integrate Trigger into Desktop Detail Header

**Files:**
- Modify: `packages/kit/src/views/Market/MarketDetailV2/components/TokenDetailHeader/TokenDetailHeaderLeft.tsx`

- [ ] **Step 1: Replace the static token display with the Popover selector**

In `TokenDetailHeaderLeft.tsx`, the current `Token` + `SizableText` (symbol) display at lines 116-138 should be wrapped with (or replaced by) the `MarketTokenSelector` Popover component from Task 5.

The existing `Token` icon and symbol text become the Popover trigger. The rest of the header (address, social links, badges) remains unchanged.

Import the new component:
```typescript
import { MarketTokenSelector } from '../TokenSelector/MarketTokenSelector';
```

Replace the `<Token>` and symbol `<SizableText>` block (lines 117-138) with:
```typescript
<MarketTokenSelector
  tokenDetail={tokenDetail}
  networkId={networkId}
  networkLogoUri={effectiveNetworkLogoUri}
  isNative={isNative}
/>
```

Keep the existing address row, social links, badges, star, and share button below.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/MarketDetailV2/components/TokenDetailHeader/TokenDetailHeaderLeft.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/views/Market/MarketDetailV2/components/TokenDetailHeader/TokenDetailHeaderLeft.tsx
git commit -m "feat(market): integrate token selector Popover in desktop detail header"
```

---

### Task 7: Integrate Trigger into Mobile Detail Header

**Files:**
- Modify: `packages/kit/src/views/Market/MarketDetailV2/components/MarketDetailHeader/MarketDetailHeader.tsx`

- [ ] **Step 1: Add clickable token selector to mobile header**

In `MarketDetailHeader.tsx`, the mobile header (lines 37-50, `media.md` branch) currently shows `NavBackButton` + `TokenDetailHeader`.

Replace the `TokenDetailHeader` in the mobile branch with a clickable trigger that shows token icon + symbol + chevron, and opens the mobile token selector modal on press.

```typescript
import { useCallback } from 'react';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalMarketRoutes } from '../../../router';
import { useTokenDetail } from '../../hooks/useTokenDetail';
```

In the component body, add:
```typescript
const navigation = useAppNavigation();
const { tokenDetail } = useTokenDetail();

const onPressTokenSelector = useCallback(() => {
  navigation.pushModal(EModalRoutes.MarketModal, {
    screen: EModalMarketRoutes.MobileTokenSelector,
  });
}, [navigation]);
```

Replace the mobile header's `TokenDetailHeader` (lines 41-49) with:
```typescript
<XStack
  alignItems="center"
  gap="$2"
  onPress={onPressTokenSelector}
  hoverStyle={{ opacity: 0.8 }}
  pressStyle={{ opacity: 0.6 }}
  cursor="default"
  flex={1}
>
  <Token
    size="sm"
    tokenImageUri={tokenDetail?.logoUrl}
    tokenImageUris={tokenDetail?.logoUrls}
    fallbackIcon="CryptoCoinOutline"
  />
  <SizableText size="$headingLg" numberOfLines={1}>
    {tokenDetail?.symbol || ''}
  </SizableText>
  <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
</XStack>
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit packages/kit/src/views/Market/MarketDetailV2/components/MarketDetailHeader/MarketDetailHeader.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/views/Market/MarketDetailV2/components/MarketDetailHeader/MarketDetailHeader.tsx
git commit -m "feat(market): integrate token selector trigger in mobile detail header"
```

---

### Task 8: Manual Testing & Verification

- [ ] **Step 1: Start desktop dev server**

Run: `yarn app:desktop`

Verify:
1. Navigate to Market → click any token → detail page opens
2. Click the token name/icon in the header → Popover search panel opens
3. Search for a token → results filter correctly
4. Switch tabs (Watchlist/Spot/Futures) → correct data and filters show
5. Select a different token → detail page updates inline (no full page reload visible)
6. URL in browser updates to the new token's address
7. Press back → returns to Market home (not previous token)

- [ ] **Step 2: Test mobile (iOS simulator or device)**

Run: `yarn app:ios`

Verify:
1. Navigate to Market → tap any token → detail page opens
2. Tap the token name in the header → full-screen search modal opens
3. Search, switch tabs, use filters → all work correctly
4. Select a different token → modal closes, detail page updates
5. Press back → returns to Market home

- [ ] **Step 3: Test web and extension**

Run: `yarn app:web` and `yarn app:ext`

Verify same flows as desktop.

- [ ] **Step 4: Run lint and type check**

```bash
yarn lint:staged
yarn tsc:staged
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(market): address token selector integration issues"
```
