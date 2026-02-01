# Connect Wallet Modal Refactor

## Overview

Refactor the ConnectWalletModal from a tab-based structure to a unified wallet list with automatic wallet detection. The goal is to create an open platform approach where any installed wallet can connect, while keeping OneKey prominently featured.

## Current State

- Tab structure: "OneKey wallet" | "Others" | "Watch-only"
- OneKey tab shows Extension + Hardware Wallet options
- Others tab shows detected wallets in a 2-column grid
- Watch-only tab shows address input form
- Mobile shows simplified view with Hardware + WalletConnect + Watch-only

## Target State

### Desktop

```
┌─────────────────────────────────────┐
│  Connect wallet                   X │
├─────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐  │
│  │ 🟢 OneKey    │ │ 🦊 MetaMask  │  │
│  │ [Recommended]│ │    EVM       │  │
│  └──────────────┘ └──────────────┘  │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ 🐰 Rabby     │ │ 👻 Phantom   │  │
│  │    EVM       │ │    SOL       │  │
│  └──────────────┘ └──────────────┘  │
│  ┌──────────────┐                   │
│  │ 🔗 WalletCon │                   │
│  └──────────────┘                   │
│                                     │
│  Terms & Privacy                    │
└─────────────────────────────────────┘
```

- No tabs, unified grid layout (2 columns)
- OneKey Extension as first item with "Recommended" badge
- Detected wallets + fallback wallets
- WalletConnect at the end

### Mobile

- Only WalletConnect option (no changes to simplicity)
- No OneKey Extension (not applicable on mobile browsers)
- No Hardware Wallet
- No Watch-only

## Implementation Details

### Files to Modify

1. **ExternalWalletList.tsx** - Add OneKey as pinned first item
2. **ConnectWalletModal.tsx** - Remove tabs, simplify structure

### ExternalWalletList.tsx Changes

#### 1. Add OneKeyWalletItem Component

```typescript
function OneKeyWalletItem({ networkType }: { networkType?: string }) {
  const intl = useIntl();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } = useOneKeyWalletDetection();
  const { connectToWalletWithDialog, loading } = useConnectExternalWallet();

  const handlePress = useCallback(() => {
    if (isOneKeyInstalled) {
      const connectionInfo = getOneKeyConnectionInfo();
      if (connectionInfo) {
        void connectToWalletWithDialog(connectionInfo);
      }
    } else {
      openUrlExternal(EXT_RATE_URL.chrome);
    }
  }, [isOneKeyInstalled, getOneKeyConnectionInfo, connectToWalletWithDialog]);

  const onekeyLogo = externalWalletLogoUtils.getLogoInfo('onekey');

  return (
    <Stack flexBasis="50%" p="$1.5">
      <Stack
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        py="$3"
        px="$5"
        cursor="pointer"
        hoverStyle={{ bg: '$bgStrong' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handlePress}
        position="relative"
        minHeight={70}
      >
        {/* Recommended Badge */}
        <Stack position="absolute" top="$2" right="$2">
          <Badge badgeType="success" badgeSize="sm">
            {intl.formatMessage({ id: ETranslations.global_recommended })}
          </Badge>
        </Stack>

        <XStack alignItems="center" gap="$3" flex={1}>
          <Stack w="$10" h="$10" borderRadius="$2" overflow="hidden">
            {loading ? (
              <Spinner size="small" />
            ) : (
              <Icon name="OnekeyBrand" size="$10" bg="#44D62C" borderRadius="$2" />
            )}
          </Stack>
          <Stack flex={1} justifyContent="center">
            <SizableText size="$bodyLgMedium">OneKey Extension</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {isOneKeyInstalled ? networkType : intl.formatMessage({ id: ETranslations.global_not_installed })}
            </SizableText>
          </Stack>
        </XStack>
      </Stack>
    </Stack>
  );
}
```

#### 2. Keep OneKey Filter (Avoid Duplicates)

```typescript
// Keep this filter to avoid showing OneKey twice
if (item.name?.toLowerCase().includes('onekey')) {
  return false;
}
```

#### 3. Insert OneKey as First Item

```typescript
return (
  <Stack px="$5" py="$4">
    <XStack flexWrap="wrap" mx="$-1.5">
      <OneKeyWalletItem networkType={networkLabel} />  {/* First item */}
      {walletItems}
      {fallbackWalletItems}
      <WalletConnectItem impl={impl} />
    </XStack>
  </Stack>
);
```

### ConnectWalletModal.tsx Changes

#### 1. Remove Imports

```typescript
// Remove these imports
- import { Tabs } from '@onekeyhq/components';
- import { useImportAddressForm } from '...';
- import { WatchOnlyWalletContent } from './WatchOnlyWalletContent';
- import { OneKeyWalletConnectionOptions } from './OneKeyWalletConnectionOptions';
```

#### 2. Simplify Component

```typescript
function ConnectWalletContent() {
  const intl = useIntl();
  const media = useMedia();
  const actions = useAccountSelectorActions();

  useEffect(() => {
    void actions.current.autoSelectNextAccount({ sceneName, num });
  }, [actions]);

  const isMobile = media.md;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_connect_wallet })}
      />
      <Page.Body>
        <Stack flex={1}>
          {isMobile ? (
            <Stack p="$5" gap="$4" flex={1}>
              <WalletConnectListItemComponent impl="evm" />
            </Stack>
          ) : (
            <ExternalWalletList impl="evm" />
          )}
          <TermsAndPrivacy contentContainerProps={{ pb: '$6' }} />
        </Stack>
      </Page.Body>
    </Page>
  );
}
```

#### 3. Remove These Items

- `defaultTab` route parameter handling
- `activeTabIndex` state
- `renderTabs` memo
- `watchOnlyFormState`
- `Page.Footer` (was for Watch-only confirmation)
- Tab-related title translations (`onekeyTitle`, `othersTitle`, `watchOnlyTitle`)

## Removed Features

| Feature | Reason |
|---------|--------|
| Tab structure | Replaced by unified list |
| Watch-only wallet entry | Entry point moved elsewhere |
| Hardware Wallet option | Not needed in this modal |
| `defaultTab` route param | No more tabs |

## Testing Checklist

- [ ] Desktop: OneKey shows as first item with Recommended badge
- [ ] Desktop: Clicking OneKey when installed triggers connection
- [ ] Desktop: Clicking OneKey when not installed opens Chrome store
- [ ] Desktop: Other detected wallets display correctly
- [ ] Desktop: WalletConnect works
- [ ] Mobile: Only WalletConnect option shows
- [ ] Mobile: WalletConnect works
- [ ] Terms & Privacy displays on both platforms
