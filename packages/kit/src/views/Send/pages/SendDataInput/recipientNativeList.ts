import { useMemo } from 'react';

import { useTheme } from '@onekeyhq/components';
import { TOKEN_ROW_CONTAINER_STYLE } from '@onekeyhq/kit/src/components/TokenListView/tokenListRowLayout';

import { useAccountSelectorNativeListThemeV2 } from '../../../AccountManagerStacks/pages/AccountSelectorStack/accountSelectorNativeListV2';

import { shortenRecipientAddress } from './recipientListAddressUtils';

import type {
  IdentityRow,
  LeadingVisual,
  NativeListSnapshot,
  NativeListTheme,
  RowModel,
} from '@onekeyfe/react-native-native-list';

// The medium account avatar of the JS rows.
const AVATAR_SIZE = 32;
// Whichever of the wallet and the account keeps its width takes at most this
// share of the title line.
const KEPT_NAME_MAX_WIDTH_RATIO = 0.7;

export function recipientBlockieVisual(address: string): LeadingVisual {
  const seed = address.replaceAll(':', '').toLowerCase();
  return {
    kind: 'account',
    shape: 'rounded',
    image: seed
      ? {
          uri: `onekey-avatar://blockie/v1/${encodeURIComponent(seed)}`,
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          contentFit: 'contain',
        }
      : undefined,
  };
}

// "Wallet / Account": the wallet gives way first, unless it has to stay whole
// (two rows share the account name, or it says the keys are elsewhere); then
// the account does. Whichever stays is capped at 70% of the line.
export function recipientWalletAccountTitle({
  walletName,
  accountName,
  keepWalletName,
}: {
  walletName: string;
  accountName: string;
  keepWalletName: boolean;
}): Pick<IdentityRow, 'title' | 'titleSegments'> {
  return {
    title: `${walletName} / ${accountName}`,
    titleSegments: [
      {
        text: walletName,
        tone: 'secondary',
        fontWeight: 'regular',
        shrink: !keepWalletName,
        maxWidthRatio: keepWalletName ? KEPT_NAME_MAX_WIDTH_RATIO : undefined,
      },
      { text: ' / ', tone: 'secondary', fontWeight: 'regular' },
      {
        text: accountName,
        tone: 'primary',
        fontWeight: 'medium',
        shrink: keepWalletName,
        maxWidthRatio: keepWalletName ? undefined : KEPT_NAME_MAX_WIDTH_RATIO,
      },
    ],
  };
}

export function recipientIdentityRow({
  key,
  testID,
  address,
  name,
  title,
  titleSegments,
  titleLeadingIcon,
  secondary,
  isFullAddress = false,
  leading,
  badges,
  trailing,
  longPressActionKey,
}: {
  key: string;
  testID?: string;
  address: string;
  name?: string;
  // Defaults to the name, or the short address without one.
  title?: string;
  titleSegments?: IdentityRow['titleSegments'];
  titleLeadingIcon?: IdentityRow['titleLeadingIcon'];
  secondary?: string;
  // The full address wraps; the one-line details are cut at the end.
  isFullAddress?: boolean;
  leading?: LeadingVisual;
  badges?: IdentityRow['badges'];
  trailing?: IdentityRow['trailing'];
  longPressActionKey?: string;
}): IdentityRow {
  return {
    type: 'identity',
    key,
    testID,
    leading: leading ?? recipientBlockieVisual(address),
    title: title ?? (name || shortenRecipientAddress(address)),
    titleSegments,
    titleLeadingIcon,
    badges,
    subtitle: secondary,
    subtitleLines: isFullAddress ? 0 : 1,
    contentHeight: 'auto',
    longPressActionKey,
    trailing,
    style: {
      container: TOKEN_ROW_CONTAINER_STYLE,
      horizontalPadding: 8,
      verticalPadding: 12,
      leadingGap: 12,
      trailingGap: 8,
      image: { width: AVATAR_SIZE, height: AVATAR_SIZE, shape: 'rounded' },
      title: { fontSize: 16, lineHeight: 24, fontWeight: 'medium' },
      subtitle: { fontSize: 14, lineHeight: 20 },
    },
  };
}

export function useRecipientNativeListTheme(): NativeListTheme {
  const accountSelectorTheme = useAccountSelectorNativeListThemeV2();
  const theme = useTheme();
  return useMemo(
    () => ({ ...accountSelectorTheme, rowHoverBackground: theme.bgHover.val }),
    [accountSelectorTheme, theme],
  );
}

export function recipientSnapshot(
  rows: readonly RowModel[],
  theme: NativeListTheme,
): NativeListSnapshot {
  return {
    schemaVersion: 1,
    generation: 1,
    layout: { kind: 'linear', contentPaddingHorizontal: 10 },
    theme,
    rows,
  };
}
