import { useIntl } from 'react-intl';

import {
  Icon,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';

import HeaderLeftToolBarInput from './HeaderLeftToolBarInput';

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
  const { hostSecurity, iconConfig } = useUrlRiskConfig(url);
  const intl = useIntl();
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
        <Icon
          size="$5"
          color={iconConfig.iconColor}
          name={iconConfig.iconName}
        />
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
          title={
            <Tooltip.Text shortcutKey={EShortcutEvents.GoBackHistory}>
              {intl.formatMessage({ id: ETranslations.shortcut_go_back })}
            </Tooltip.Text>
          }
          titlePlacement="bottom"
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
          titlePlacement="bottom"
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
          titlePlacement="bottom"
          icon={loading ? 'CrossedLargeOutline' : 'RotateClockwiseOutline'}
          onPress={loading ? stopLoading : reload}
          testID={`action-header-item-${loading ? 'stop-loading' : 'reload'}`}
        />
      </HeaderButtonGroup>
      <HeaderLeftToolBarInput
        url={url}
        hostSecurity={hostSecurity}
        iconConfig={iconConfig}
        inputProps={{
          onPress: !platformEnv.isDesktop ? () => onSearch?.(url) : undefined,
        }}
        isBookmark={isBookmark}
        isPinned={isPinned}
        isLoading={loading}
        onBookmarkPress={onBookmarkPress}
        onPinnedPress={onPinnedPress}
      />
    </XStack>
  );
}

export default HeaderLeftToolBar;
