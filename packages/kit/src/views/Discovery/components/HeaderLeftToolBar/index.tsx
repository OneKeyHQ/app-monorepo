import { useMedia } from 'tamagui';

import { IconButton, Input, Stack, XStack } from '@onekeyhq/components';

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
  isBookmark,
  onBookmarkPress,
  isPinned,
  onPinnedPress,
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
  isBookmark?: boolean;
  onBookmarkPress?: (bookmark: boolean) => void;
  isPinned?: boolean;
  onPinnedPress?: (pinned: boolean) => void;
}) {
  const media = useMedia();

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
            iconName: isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
            onPress: () => onBookmarkPress?.(!isBookmark),
          },
          {
            iconName: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress?.(!isPinned),
          },
        ]}
      />
    </XStack>
  );
}

export default HeaderLeftToolBar;
