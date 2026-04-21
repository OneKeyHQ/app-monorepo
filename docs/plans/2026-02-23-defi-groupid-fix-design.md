# DeFi Position GroupId Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore visual grouping of DeFi positions by `groupId` on both the Home page and Detail page.

**Architecture:** Revert Franco's V6 UI changes that moved position header info into table column headers, breaking visual separation. Restore the per-position header row (badge + poolName + value) above each RichTable, and fix the React key bug in DeFiProtocolDetails.tsx.

**Tech Stack:** React, TypeScript, @onekeyhq/components (Badge, Popover, NumberSizeableTextWrapper, RichTable)

---

## Root Cause

Franco's V6 commits (`2cf38de9c5`, `33c3613073`) made breaking changes:
1. **Protocol.tsx:** Removed position header row, moved badge+poolName into table column header as ReactNode
2. **DeFiProtocolDetails.tsx:** Pre-existing `key={position.category}` bug causes React key collisions

Data layer (`defiUtils.ts`) is correct — `groupId` merging works.

---

### Task 1: Create Feature Branch

**Step 1: Create branch from x**

```bash
git checkout x && git checkout -b fix/defi-groupid-visual-grouping
```

**Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `fix/defi-groupid-visual-grouping`

---

### Task 2: Restore Shared Columns in Protocol.tsx

**Files:**
- Modify: `packages/kit/src/views/Home/components/DeFiListBlock/Protocol.tsx`

**Step 1: Add `useMemo` to import**

Change line 1:
```tsx
// FROM:
import { useCallback } from 'react';
// TO:
import { useCallback, useMemo } from 'react';
```

**Step 2: Replace `getColumns` callback with shared `columns` useMemo**

Replace lines 62-207 (the entire `getColumns` callback) with:

```tsx
  const columns = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.global_asset }),
        dataIndex: 'symbol',
        render: (symbol: string, record: IDeFiAsset) => (
          <XStack gap="$3" alignItems="center">
            <Token size="sm" tokenImageUri={record.meta?.logoUrl} />
            <SizableText size="$bodyMdMedium">{symbol}</SizableText>
          </XStack>
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.wallet_defi_portfolio_column_type,
        }),
        dataIndex: 'category',
        render: (
          category: string,
          record: IDeFiAsset & { type: EDeFiAssetType },
        ) => {
          let type = '';
          let typeColor = '$blue10';
          // show en value instead of translation id
          if (record.type === EDeFiAssetType.DEBT) {
            type = 'Borrowed';
            typeColor = '$orange10';
          } else if (record.type === EDeFiAssetType.REWARD) {
            type = 'Rewards';
            typeColor = '$teal10';
          } else if (record.type === EDeFiAssetType.ASSET) {
            type = 'Supplied';
            typeColor = '$blue10';
          } else {
            type = category;
          }
          return (
            <XStack gap="$1" alignItems="center">
              <Stack
                width={7}
                height={7}
                borderRadius="$full"
                backgroundColor={typeColor}
              />
              <SizableText size="$bodyMdMedium" textTransform="capitalize">
                {type}
              </SizableText>
            </XStack>
          );
        },
      },
      {
        title: intl.formatMessage({
          id: ETranslations.wallet_defi_portfolio_column_amount,
        }),
        dataIndex: 'amount',
        render: (amount: string) => (
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="balance"
          >
            {amount}
          </NumberSizeableTextWrapper>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_value }),
        dataIndex: 'value',
        render: (value: string) => {
          const valueBN = new BigNumber(value);
          const isValueUnavailable = valueBN.isNaN() || valueBN.isZero();
          return (
            <XStack alignItems="center" gap="$1">
              {isValueUnavailable ? (
                <Stack width="$4" height="$4">
                  <Tooltip
                    renderContent={intl.formatMessage({
                      id: ETranslations.wallet_price_unavailable,
                    })}
                    renderTrigger={
                      <Icon
                        name="ErrorOutline"
                        size="$4"
                        color="$iconCritical"
                      />
                    }
                  />
                </Stack>
              ) : null}
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMdMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {isValueUnavailable ? '--' : valueBN.toFixed()}
              </NumberSizeableTextWrapper>
            </XStack>
          );
        },
      },
    ];
  }, [settings.currencyInfo.symbol, intl]);
```

Key differences from Franco's version:
- `title` fields are strings, not ReactNode
- Text sizes restored to `$bodyMdMedium` (Franco changed to `$bodyMd`)
- No badge/poolName in column header
- Shared across all positions (not per-position)

---

### Task 3: Restore Position Header Row in Protocol.tsx

**Files:**
- Modify: `packages/kit/src/views/Home/components/DeFiListBlock/Protocol.tsx`

**Step 1: Add `Fragment` import**

Add to line 1 (with the React import):
```tsx
import { Fragment, useCallback, useMemo } from 'react';
```

**Step 2: Replace `renderProtocolPositions` function**

Replace lines 209-243 (the entire `renderProtocolPositions` callback) with:

```tsx
  const renderProtocolPositions = useCallback(() => {
    return protocol.positions.map((position, index) => {
      return (
        <Fragment key={position.groupId}>
          <Stack>
            <XStack
              alignItems="center"
              justifyContent="space-between"
              px="$pagePadding"
              py="$3"
              gap="$3"
            >
              <XStack gap="$3" alignItems="center" flex={1}>
                <Badge
                  bg={getCategoryConfig(position.category).bg}
                  badgeSize="sm"
                >
                  <Badge.Text
                    textTransform="capitalize"
                    color={getCategoryConfig(position.category).text}
                  >
                    {`${getCategoryConfig(position.category).emoji} ${position.category}`}
                  </Badge.Text>
                </Badge>
                <Popover
                  hoverable
                  placement="top"
                  title={intl.formatMessage({
                    id: ETranslations.wallet_defi_position_name_popover_title,
                  })}
                  renderTrigger={
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      textDecorationLine="underline"
                      textDecorationColor="$textSubdued"
                      textDecorationStyle="dotted"
                    >
                      {position.poolName}
                    </SizableText>
                  }
                  renderContent={
                    <Stack px="$4" py="$2">
                      <SizableText size="$bodyLgMedium">
                        {position.poolFullName}
                      </SizableText>
                    </Stack>
                  }
                />
              </XStack>
              <NumberSizeableTextWrapper
                hideValue
                size="$headingSm"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {position.value}
              </NumberSizeableTextWrapper>
            </XStack>
            <RichTable<IDeFiAsset & { type: EDeFiAssetType }>
              dataSource={[
                ...position.assets,
                ...position.debts,
                ...position.rewards,
              ]}
              columns={columns}
              keyExtractor={(item) => item.address}
              estimatedItemSize={44}
              onRow={() => ({
                onPress: undefined,
              })}
              rowProps={{
                mx: '$2',
                minHeight: 44,
              }}
              headerRowProps={{
                py: '$2',
                px: '$3',
                mx: '$2',
              }}
            />
          </Stack>
          {index !== protocol.positions.length - 1 ? (
            <Divider mx="$pagePadding" my="$2" />
          ) : null}
        </Fragment>
      );
    });
  }, [protocol.positions, intl, settings.currencyInfo.symbol, columns]);
```

Key changes from current code:
- `<Fragment key={position.groupId}>` instead of `<>` (fixes React key warning)
- Position header row restored: `<XStack>` with Badge + Popover + value
- Uses `getCategoryConfig()` colors with emoji (keep Franco's color scheme, user said skip emoji changes)
- `columns={columns}` shared useMemo instead of `columns={getColumns(position)}`
- `position.value` displayed in header row (was removed by Franco)

---

### Task 4: Fix Key Bug in DeFiProtocolDetails.tsx

**Files:**
- Modify: `packages/kit/src/views/AssetDetails/pages/DeFiProtocolDetails.tsx:146`

**Step 1: Change React key from `position.category` to `position.groupId`**

Line 146, change:
```tsx
// FROM:
<Stack key={position.category} px="$5">
// TO:
<Stack key={position.groupId} px="$5">
```

This fixes React key collisions when multiple positions share the same category (e.g., two "lending" positions with different groupIds).

---

### Task 5: Lint & Type Check

**Step 1: Stage changed files**

```bash
git add packages/kit/src/views/Home/components/DeFiListBlock/Protocol.tsx packages/kit/src/views/AssetDetails/pages/DeFiProtocolDetails.tsx
```

**Step 2: Run lint**

```bash
yarn lint:staged
```

Expected: No errors

**Step 3: Run type check**

```bash
yarn tsc:staged
```

Expected: No errors

**Step 4: Fix any issues found, re-stage, and re-check**

---

### Task 6: Commit, Push, and Create PR

**Step 1: Commit**

```bash
git commit -m "fix(defi): restore position header row and fix groupId key bug"
```

**Step 2: Push**

```bash
git push -u origin fix/defi-groupid-visual-grouping
```

**Step 3: Create PR**

```bash
gh pr create --base x --title "fix(defi): restore position header row grouping and fix key bug" --body "$(cat <<'EOF'
## Summary
- Restore per-position header row (category badge + pool name + value) in Protocol.tsx table layout
- Revert table column header from ReactNode back to string titles
- Fix `key={position.category}` → `key={position.groupId}` in DeFiProtocolDetails.tsx

## Root Cause
Franco's V6 UI commits moved position header info into the RichTable column header as ReactNode, removing the visual separation between positions. This caused LP tokens and rewards in a Liquidity Pool to appear as separate ungrouped sections.

## Test plan
- [ ] Verify DeFi positions on Home page (table layout) show position header row with badge + pool name + value
- [ ] Verify positions with same groupId are visually grouped together
- [ ] Verify DeFi protocol detail page renders correctly with no key collision warnings
- [ ] Verify mobile list view still works (unchanged)
EOF
)"
```
