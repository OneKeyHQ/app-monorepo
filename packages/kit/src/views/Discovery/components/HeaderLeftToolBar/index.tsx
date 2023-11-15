import { useMedia } from 'tamagui';

import { IconButton, Input, XStack } from '@onekeyhq/components';

function HeaderLeftToolBar({
  url,
  canGoBack,
  canGoForward,
  loading,
  goBack,
  goForward,
  stopLoading,
  reload,
}: {
  url: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  goBack?: () => void;
  goForward?: () => void;
  stopLoading?: () => void;
  reload?: () => void;
}) {
  const media = useMedia();

  if (media.md) {
    return (
      <Input
        containerProps={{ ml: '$6' }}
        size="medium"
        leftIconName="LockSolid"
        value={url}
      />
    );
  }
  return (
    <XStack alignItems="center" justifyContent="center">
      <XStack space="$6">
        <IconButton
          size="medium"
          variant="tertiary"
          icon="ChevronLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
        />
        <IconButton
          size="medium"
          variant="tertiary"
          icon="ChevronRightOutline"
          disabled={!canGoForward}
          onPress={goForward}
        />
        <IconButton
          size="medium"
          variant="tertiary"
          icon={loading ? 'CrossedLargeOutline' : 'RotateClockwiseOutline'}
          onPress={loading ? stopLoading : reload}
        />
      </XStack>
      <Input
        containerProps={{ ml: '$6' }}
        size="small"
        leftIconName="LockSolid"
        value={url}
        addOns={[
          {
            iconName: 'StarOutline',
            onPress: () => {
              console.log('bookmark');
            },
          },
          {
            iconName: 'PinOutline',
            onPress: () => {
              console.log('pin');
            },
          },
        ]}
      />
    </XStack>
  );
}

export default HeaderLeftToolBar;
