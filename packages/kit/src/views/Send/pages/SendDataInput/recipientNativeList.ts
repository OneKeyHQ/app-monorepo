import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type {
  IdentityRow,
  LeadingVisual,
  NativeListSnapshot,
  NativeListTheme,
  RowModel,
} from '@onekeyfe/react-native-native-list';

export function recipientBlockieVisual(address: string): LeadingVisual {
  const seed = address.replaceAll(':', '').toLowerCase();
  return {
    kind: 'account',
    shape: 'rounded',
    image: seed
      ? {
          uri: `onekey-avatar://blockie/v1/${encodeURIComponent(seed)}`,
          width: 40,
          height: 40,
          contentFit: 'contain',
        }
      : undefined,
  };
}

export function recipientIdentityRow({
  key,
  testID,
  address,
  name,
  secondary,
  leading,
  titleSuffixes,
  trailing,
  longPressActionKey,
}: {
  key: string;
  testID?: string;
  address: string;
  name?: string;
  secondary?: string;
  leading?: LeadingVisual;
  titleSuffixes?: IdentityRow['titleSuffixes'];
  trailing?: IdentityRow['trailing'];
  longPressActionKey?: string;
}): IdentityRow {
  return {
    type: 'identity',
    key,
    testID,
    leading: leading ?? recipientBlockieVisual(address),
    title: name || accountUtils.shortenAddress({ address }),
    subtitle: secondary ?? address,
    subtitleLines: 0,
    contentHeight: 'auto',
    longPressActionKey,
    titleSuffixes,
    trailing,
    style: {
      horizontalPadding: 8,
      verticalPadding: 12,
      leadingGap: 12,
      trailingGap: 8,
      image: { width: 40, height: 40, shape: 'rounded' },
      title: { fontSize: 16, lineHeight: 24, fontWeight: 'medium' },
      subtitle: { fontSize: 14, lineHeight: 20 },
    },
  };
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
