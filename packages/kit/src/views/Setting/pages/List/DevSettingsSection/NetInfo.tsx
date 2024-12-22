import {
  Button,
  SizableText,
  XStack,
  YStack,
  refresh,
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
            refresh();
          }}
        >
          Refresh
        </Button>
      </XStack>
    </YStack>
  );
}
