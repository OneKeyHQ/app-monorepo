import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { DiscoveryTestIDs } from '../../testIDs';
import { ESiteMode, type IMobileBottomOptionsProps } from '../../types';

import { logBrowserChromeAction } from './browserChrome';

import type { IntlShape } from 'react-intl';

export const ACTION_LIST_CLOSE_ANIMATION_DELAY_MS = 350;

// For actions that open another sheet or modal (or close the page under the
// menu): close the menu and wait for its animation first.
function runAfterMenuClose(action: () => void) {
  return async (close: () => void) => {
    close();
    await timerUtils.wait(ACTION_LIST_CLOSE_ANIMATION_DELAY_MS);
    action();
  };
}

function withMenuLog<TArgs extends unknown[], TResult>(
  action: IBrowserToolbarAction,
  handler: (...args: TArgs) => TResult,
) {
  return (...args: TArgs) => {
    logBrowserChromeAction(action, 'menu');
    return handler(...args);
  };
}

// Ordered by usage (30-day analytics): bookmark/share/copy first, page
// tools (translate is used by very few people) next, tab/session actions
// last. Reload and back-to-Explore are left out: the bar's refresh button
// and the header's minimize button already cover them.
function buildOptionsSections(
  intl: IntlShape,
  {
    isBookmark,
    onBookmarkPress,
    onShare,
    onCopyUrl,
    isPinned,
    onPinnedPress,
    onBrowserOpen,
    onCloseTab,
    displayDisconnectOption,
    onDisconnect,
    siteMode,
    onRequestSiteMode,
    canGoForward,
    onGoForward,
    isTranslated,
    onTranslatePress,
  }: IMobileBottomOptionsProps,
) {
  return [
    {
      items: [
        canGoForward
          ? {
              label: intl.formatMessage({
                id: ETranslations.shortcut_go_forward,
              }),
              icon: 'ChevronRightOutline',
              onPress: onGoForward,
              testID: DiscoveryTestIDs.browserForwardButton,
            }
          : undefined,
        {
          label: intl.formatMessage({
            id: isBookmark
              ? ETranslations.explore_remove_bookmark
              : ETranslations.explore_add_bookmark,
          }),
          icon: isBookmark ? 'StarSolid' : 'StarOutline',
          onPress: () => onBookmarkPress(!isBookmark),
          testID: DiscoveryTestIDs.tabActionBookmark,
        },
        {
          label: intl.formatMessage({ id: ETranslations.explore_share }),
          icon: 'ShareOutline',
          onPress: () => onShare(),
          testID: DiscoveryTestIDs.browserShareButton,
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_copy_url }),
          icon: 'LinkOutline',
          onPress: () => {
            onCopyUrl();
          },
          testID: `action-list-item-copy`,
        },
      ].filter(Boolean) as IActionListItemProps[],
    },
    {
      items: [
        {
          label: intl.formatMessage({
            id: ETranslations.browser_translate_settings_title,
          }),
          icon: isTranslated ? 'TranslateSolid' : 'TranslateOutline',
          // The translate sheet can only open once this menu is gone.
          onPress: runAfterMenuClose(onTranslatePress),
          testID: 'browser-bar-translate',
        },
        platformEnv.isNativeIOSPad
          ? undefined
          : {
              label: intl.formatMessage({
                id:
                  siteMode === ESiteMode.desktop
                    ? ETranslations.browser_request_mobile_site
                    : ETranslations.browser_request_desktop_site,
              }),
              icon:
                siteMode === ESiteMode.desktop
                  ? 'PhoneOutline'
                  : 'ComputerOutline',
              onPress: () => {
                onRequestSiteMode(
                  siteMode === ESiteMode.desktop
                    ? ESiteMode.mobile
                    : ESiteMode.desktop,
                );
              },
              testID: `action-list-item-${
                siteMode === ESiteMode.desktop ? 'mobile' : 'desktop'
              }`,
            },
        {
          label: intl.formatMessage({
            id: ETranslations.explore_open_in_browser,
          }),
          icon: 'CompassCircleOutline',
          onPress: () => onBrowserOpen(),
          testID: 'action-list-item-open-in-browser',
        },
      ].filter(Boolean) as IActionListItemProps[],
    },
    {
      items: [
        {
          label: intl.formatMessage({
            id: isPinned
              ? ETranslations.explore_unpin
              : ETranslations.explore_pin,
          }),
          icon: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
          onPress: () => onPinnedPress(!isPinned),
          testID: DiscoveryTestIDs.tabActionPin(!!isPinned),
        },
        displayDisconnectOption && {
          label: intl.formatMessage({
            id: ETranslations.explore_disconnect,
          }),
          icon: 'BrokenLinkOutline',
          onPress: onDisconnect,
          testID: 'action-list-item-disconnect-in-browser',
        },
        {
          label: intl.formatMessage({
            id: isPinned
              ? ETranslations.explore_close_pin_tab
              : ETranslations.explore_close_tab,
          }),
          icon: 'CrossedLargeOutline',
          destructive: true,
          onPress: runAfterMenuClose(onCloseTab),
          testID: DiscoveryTestIDs.tabActionClose,
        },
      ].filter(Boolean) as IActionListItemProps[],
    },
  ];
}

// The browser "options" menu, opened programmatically so it also works from
// the Android bottom bar (see ChromePressable) where trigger components get no
// touch. Sections are built only when the menu opens; the returned callback
// stays stable while tab state changes.
export function useMobileBrowserOptions(props: IMobileBottomOptionsProps) {
  const intl = useIntl();
  const propsRef = useRef(props);
  propsRef.current = props;
  return useCallback(() => {
    const current = propsRef.current;
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.explore_options }),
      sections: buildOptionsSections(intl, {
        ...current,
        onGoForward: withMenuLog('forward', current.onGoForward),
        onTranslatePress: withMenuLog('translate', current.onTranslatePress),
        onShare: withMenuLog('share', current.onShare),
        onCopyUrl: withMenuLog('copyUrl', current.onCopyUrl),
        onBrowserOpen: withMenuLog('openInBrowser', current.onBrowserOpen),
        onRequestSiteMode: withMenuLog('siteMode', current.onRequestSiteMode),
      }),
    });
  }, [intl]);
}
