import { Stack, Text } from '@onekeyhq/components';

type IEmptyStateType = 'loading' | 'locked' | 'noWallet' | 'offline';

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
      <Text fontSize="$headingMd" color="$text" marginBottom="$2">
        {message.title}
      </Text>
      <Text fontSize="$bodySm" color="$textSubdued">
        {message.subtitle}
      </Text>
    </Stack>
  );
}
