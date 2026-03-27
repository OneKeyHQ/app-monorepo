import { Stack, SizableText } from '@onekeyhq/components';

type IEmptyStateType = 'loading' | 'locked' | 'noWallet' | 'offline';

// TODO: i18n — replace with ETranslations keys when available
// Keys to register on server:
//   tray.loading_title / tray.loading_subtitle
//   tray.locked_title / tray.locked_subtitle
//   tray.no_wallet_title / tray.no_wallet_subtitle
//   tray.offline_title / tray.offline_subtitle
const MESSAGES: Record<IEmptyStateType, { title: string; subtitle: string }> = {
  loading: { title: 'Loading...', subtitle: 'Connecting to OneKey' },
  locked: { title: 'App is Locked', subtitle: 'Click to unlock' },
  noWallet: { title: 'No Wallet', subtitle: 'Create or import a wallet in the app' },
  offline: { title: 'Network Unavailable', subtitle: 'Showing cached data' },
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
      padding="$4"
      onPress={onPress}
      cursor={onPress ? 'pointer' : 'default'}
    >
      <SizableText fontSize="$headingMd" color="$text" marginBottom="$2">
        {message.title}
      </SizableText>
      <SizableText fontSize="$bodySm" color="$textSubdued">
        {message.subtitle}
      </SizableText>
    </Stack>
  );
}
