import { SizableText, YStack } from '@onekeyhq/components';
import { useNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';

export function NetInfo() {
  const { type, isConnected, isWifiEnabled, isInternetReachable } =
    useNetInfo();
  return (
    <YStack>
      <SizableText>{`type: ${type}`}</SizableText>
      <SizableText>{`isConnected: ${String(isConnected)}`}</SizableText>
      <SizableText>{`isWifiEnabled: ${String(isWifiEnabled)}`}</SizableText>
      <SizableText>{`isInternetReachable: ${String(
        isInternetReachable,
      )}`}</SizableText>
    </YStack>
  );
}
