import { useMedia } from 'tamagui';

import { IconButton, Input, Stack, XStack } from '@onekeyhq/components';
import HeaderCollapseButton from '@onekeyhq/components/src/Navigation/Header/HeaderCollapseButton';
import useProviderSideBarValue from '@onekeyhq/components/src/Provider/hooks/useProviderSideBarValue';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function HeaderLeftToolBar({
  url,
  canGoBack,
  canGoForward,
  loading,
  goBack,
  goForward,
  stopLoading,
  reload,
  onSearch,
}: {
  url: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  goBack?: () => void;
  goForward?: () => void;
  stopLoading?: () => void;
  reload?: () => void;
  onSearch?: () => void;
}) {
  const media = useMedia();
  const { leftSidebarCollapsed: isCollpase } = useProviderSideBarValue();
  const paddingLeft = platformEnv.isDesktopMac && isCollpase ? '$20' : '$0';

  if (media.md) {
    return (
      <Stack flex={1} alignItems="center" onPress={() => onSearch?.()}>
        <Input
          size="medium"
          leftIconName="LockSolid"
          value={url}
          editable={false}
        />
      </Stack>
    );
  }
  return (
    <XStack alignItems="center" justifyContent="center" pl={paddingLeft}>
      <XStack space="$6">
        <HeaderCollapseButton />
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
