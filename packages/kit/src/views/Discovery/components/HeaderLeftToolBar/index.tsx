import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Input,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useShortcutsOnRouteFocused } from '@onekeyhq/kit/src/hooks/useShortcutsOnRouteFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';

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
  const intl = useIntl();
  const media = useMedia();
  const { isHttpsUrl, hiddenHttpsUrl } = formatHiddenHttpsUrl(url);

  const handleBookmark = useCallback(() => {
    onBookmarkPress?.(!isBookmark);
  }, [isBookmark, onBookmarkPress]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.AddOrRemoveBookmark,
    handleBookmark,
  );

  const handlePin = useCallback(() => {
    onPinnedPress?.(!isPinned);
  }, [isPinned, onPinnedPress]);

  useShortcutsOnRouteFocused(EShortcutEvents.PinOrUnpinTab, handlePin);

  const onChangeUrl = useCallback(() => {
    onSearch?.(url);
  }, [onSearch, url]);

  useShortcutsOnRouteFocused(EShortcutEvents.ChangeCurrentTabUrl, onChangeUrl);

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
        <Icon
          size="$5"
          color="$iconSubdued"
          name={isHttpsUrl ? 'LockSolid' : 'SearchSolid'}
        />
        <SizableText size="$bodyLg" flex={1} numberOfLines={1} ml="$2">
          {url}
        </SizableText>
      </Stack>
    );
  }
  const inputProps = {
    onPress: () => {
      onSearch?.(url);
    },
  };

  return (
    <XStack alignItems="center" justifyContent="center" pl="$2">
      <HeaderButtonGroup>
        <HeaderIconButton
          title={
            <Tooltip.Text shortcutKey={EShortcutEvents.GoBackHistory}>
              {intl.formatMessage({ id: ETranslations.shortcut_go_back })}
            </Tooltip.Text>
          }
          icon="ChevronLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
          testID="browser-bar-go-back"
        />
        <HeaderIconButton
          title={
            <Tooltip.Text shortcutKey={EShortcutEvents.GoForwardHistory}>
              {intl.formatMessage({ id: ETranslations.shortcut_go_forward })}
            </Tooltip.Text>
          }
          icon="ChevronRightOutline"
          disabled={!canGoForward}
          onPress={goForward}
          testID="browser-bar-go-forward"
        />
        <HeaderIconButton
          title={
            <Tooltip.Text shortcutKey={EShortcutEvents.Refresh}>
              {intl.formatMessage({ id: ETranslations.global_refresh })}
            </Tooltip.Text>
          }
          icon={loading ? 'CrossedLargeOutline' : 'RotateClockwiseOutline'}
          onPress={loading ? stopLoading : reload}
          testID={`action-header-item-${loading ? 'stop-loading' : 'reload'}`}
        />
      </HeaderButtonGroup>
      <Input
        containerProps={{ ml: '$6', w: '$80' } as any}
        size="small"
        leftIconName={isHttpsUrl ? 'LockSolid' : 'SearchSolid'}
        value={hiddenHttpsUrl}
        selectTextOnFocus
        testID="explore-index-search-input"
        addOns={[
          {
            iconName: isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => onBookmarkPress?.(!isBookmark),
            tooltipProps: {
              shortcutKey: EShortcutEvents.AddOrRemoveBookmark,
              renderContent: intl.formatMessage({
                id: isBookmark
                  ? ETranslations.explore_remove_bookmark
                  : ETranslations.explore_add_bookmark,
              }),
            },
            testID: `action-header-item-${
              !isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
            ...(isBookmark && {
              iconColor: '$icon',
            }),
          },
          {
            iconName: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress?.(!isPinned),
            tooltipProps: {
              shortcutKey: EShortcutEvents.PinOrUnpinTab,
              renderContent: intl.formatMessage({
                id: isPinned
                  ? ETranslations.explore_unpin
                  : ETranslations.explore_pin,
              }),
            },
            testID: `action-header-item-${!isPinned ? 'pin' : 'un-pin'}`,
            ...(isPinned && {
              iconColor: '$icon',
            }),
          },
        ]}
        {...(inputProps as any)}
      />
    </XStack>
  );
}

export default HeaderLeftToolBar;
