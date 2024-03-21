import {
  Icon,
  Input,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';

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
  onSearch?: (url: string) => void;
  isBookmark?: boolean;
  onBookmarkPress?: (bookmark: boolean) => void;
  isPinned?: boolean;
  onPinnedPress?: (pinned: boolean) => void;
}) {
  const media = useMedia();

  if (media.md) {
    return (
      <Stack
        flex={1}
        alignItems="center"
        flexDirection="row"
        onPress={() => onSearch?.(url)}
        mr="$4"
        bg="$bgStrong"
        py="$2"
        px="$2.5"
        borderRadius="$full"
        pressStyle={{
          bg: '$bgActive',
        }}
      >
        <Icon size="$5" color="$iconSubdued" name="LockSolid" />
        <SizableText size="$bodyLg" flex={1} numberOfLines={1} ml="$2">
          {url}
        </SizableText>
      </Stack>
    );
  }
  return (
    <XStack alignItems="center" justifyContent="center" pl="$2">
      <HeaderButtonGroup>
        <HeaderIconButton
          icon="ChevronLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
          testID="browser-bar-go-back"
        />
        <HeaderIconButton
          icon="ChevronRightOutline"
          disabled={!canGoForward}
          onPress={goForward}
          testID="browser-bar-go-forward"
        />
        <HeaderIconButton
          icon={loading ? 'CrossedLargeOutline' : 'RotateClockwiseOutline'}
          onPress={loading ? stopLoading : reload}
          testID={`action-header-item-${loading ? 'stop-loading' : 'reload'}`}
        />
      </HeaderButtonGroup>
      <Input
        containerProps={{ ml: '$6', w: '$80' }}
        size="small"
        leftIconName="LockSolid"
        value={url}
        onPress={() => {
          onSearch?.(url);
        }}
        addOns={[
          {
            iconName: isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => onBookmarkPress?.(!isBookmark),
            testID: `action-header-item-${
              !isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
          },
          {
            iconName: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress?.(!isPinned),
            testID: `action-header-item-${!isPinned ? 'pin' : 'un-pin'}`,
          },
        ]}
      />
    </XStack>
  );
}

export default HeaderLeftToolBar;
