import { Spinner, YStack } from '@onekeyhq/components';

interface ILoadingOverlayProps {
  visible: boolean;
}

export function LoadingOverlay({ visible }: ILoadingOverlayProps) {
  if (!visible) {
    return null;
  }
  return (
    <YStack
      bg="$bgApp"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      ai="center"
      jc="center"
      flex={1}
    >
      <Spinner size="large" />
    </YStack>
  );
}
