import { SizableText, Stack } from '@onekeyhq/components';

type IEmptyStateType = 'loading' | 'locked' | 'noWallet' | 'noContent' | 'offline';

// TODO: i18n — replace with ETranslations keys when available
const MESSAGES: Record<
  IEmptyStateType,
  { icon: string; title: string; subtitle: string }
> = {
  loading: { icon: '⏳', title: 'Loading...', subtitle: 'Connecting to OneKey' },
  locked: {
    icon: '🔒',
    title: 'App is Locked',
    subtitle: 'Click to unlock OneKey',
  },
  noWallet: {
    icon: '👋',
    title: 'No Wallet',
    subtitle: 'Create or import a wallet to get started',
  },
  noContent: {
    icon: '📊',
    title: 'No Data Yet',
    subtitle: 'Add tokens to your watchlist to see them here',
  },
  offline: {
    icon: '📡',
    title: 'Network Unavailable',
    subtitle: 'Showing cached data',
  },
};

export function TrayEmptyState({
  type,
  onPress,
}: {
  type: IEmptyStateType;
  onPress?: () => void;
}) {
  const message = MESSAGES[type];
  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      onPress={onPress}
      cursor={onPress ? 'pointer' : 'default'}
      hoverStyle={onPress ? { backgroundColor: '$bgHover' } : undefined}
    >
      <SizableText fontSize={32} marginBottom="$3">
        {message.icon}
      </SizableText>
      <SizableText fontSize="$headingSm" color="$text" marginBottom="$1.5" textAlign="center">
        {message.title}
      </SizableText>
      <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
        {message.subtitle}
      </SizableText>
    </Stack>
  );
}
