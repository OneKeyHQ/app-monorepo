import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  fetch,
  refresh,
  useNetInfo,
} from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';

export function NetInfo() {
  const {
    type,
    isConnected,
    isWifiEnabled,
    isInternetReachable,
    isRawInternetReachable,
  } = useNetInfo();
  return (
    <YStack>
      <SizableText>{`type: ${type}`}</SizableText>
      <SizableText>{`isConnected: ${String(isConnected)}`}</SizableText>
      <SizableText>{`isWifiEnabled: ${String(isWifiEnabled)}`}</SizableText>
      <SizableText>{`isInternetReachable: ${String(
        isInternetReachable,
      )}`}</SizableText>
      <SizableText>{`isRawInternetReachable: ${String(
        isRawInternetReachable,
      )}`}</SizableText>
      <XStack gap="$4">
        <Button
          onPress={() => {
            void fetch().then((state) => {
              alert(JSON.stringify(state));
            });
          }}
        >
          Fetch
        </Button>
        <Button
          onPress={() => {
            void refresh().then((state) => {
              alert(JSON.stringify(state));
            });
          }}
        >
          Refresh
        </Button>
      </XStack>
    </YStack>
  );
}
