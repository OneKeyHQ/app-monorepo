import { Spinner, YStack } from '@onekeyhq/components';

export function TabLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      ai="center"
      jc="center"
      bg="$bgApp"
      opacity={0.7}
      zIndex={1}
    >
      <Spinner size="small" />
    </YStack>
  );
}
