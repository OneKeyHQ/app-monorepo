import {
  Button,
  SizableText,
  XStack,
  YStack,
  refreshNetInfo,
  useNetInfo,
} from '@onekeyhq/components';

export function NetInfo() {
  const { isInternetReachable, isRawInternetReachable } = useNetInfo();
  return (
    <YStack>
      <SizableText>{`isInternetReachable: ${String(
        isInternetReachable,
      )}`}</SizableText>
      <SizableText>{`isRawInternetReachable: ${String(
        isRawInternetReachable,
      )}`}</SizableText>
      <XStack gap="$4">
        <Button
          onPress={() => {
            refreshNetInfo();
          }}
        >
          Refresh
        </Button>
      </XStack>
    </YStack>
  );
}
