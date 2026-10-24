import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IActionListSection,
  IKeyOfIcons,
} from '@onekeyhq/components';
import {
  ActionList,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { DiscoveryTestIDs } from '../../testIDs';
import { ESiteMode, type IMobileBottomOptionsProps } from '../../types';

import { logBrowserChromeAction } from './browserChrome';

import type { IntlShape } from 'react-intl';

const ACTION_LIST_CLOSE_ANIMATION_DELAY_MS = 350;

const QUICK_ACTION_COLUMN_WIDTH = 72;

interface IQuickAction {
  label: string;
  icon: IKeyOfIcons;
  onPress: () => void;
  // Run once the menu has closed (e.g. it opens a system sheet).
  afterClose?: boolean;
  testID: string;
}

function QuickActionTile({
  action,
  onClose,
}: {
  action: IQuickAction;
  onClose: () => void;
}) {
  return (
    <YStack
      w={QUICK_ACTION_COLUMN_WIDTH}
      alignItems="center"
      gap="$2"
      onPress={() => {
        if (action.afterClose) {
          void runAfterMenuClose(action.onPress)(onClose);
        } else {
          onClose();
          action.onPress();
        }
      }}
      testID={action.testID}
    >
      <Stack
        w="$14"
        h="$14"
        borderRadius="$4"
        borderCurve="continuous"
        bg="$bgStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={action.icon} size="$6" color="$icon" />
      </Stack>
      <SizableText size="$bodySmMedium" textAlign="center" numberOfLines={2}>
        {action.label}
      </SizableText>
    </YStack>
  );
}

// Tiles for the frequent page actions, then the regular list sections.
function OptionsMenuContent({
  quickActions,
  sections,
  onClose,
}: {
  quickActions: IQuickAction[];
  sections: IActionListSection[];
  onClose: () => void;
}) {
  return (
    <YStack>
      {/* Spread edge to edge with no side padding: each 72pt column centers
        its 56pt tile, so the outer tiles start 8pt in, on the same line as
        the list icons and dividers (both inset $2) below. */}
      <XStack pt="$1" pb="$3" justifyContent="space-between">
        {quickActions.map((action) => (
          <QuickActionTile
            key={action.testID}
            action={action}
            onClose={onClose}
          />
        ))}
      </XStack>
      {sections.map((section, index) => (
        <YStack key={index}>
          <Divider mx="$2" my="$1" />
          {section.items.map((item) => (
            <ActionList.Item key={item.label} {...item} onClose={onClose} />
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

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

// Ordered by usage (30-day analytics): the frequent page actions (copy,
// bookmark, share, open elsewhere) as a row of tiles on top, then page tools
// (translate is used by very few people), then tab/session actions. Reload
// and exit are left out: the bar's refresh and the header's ✕ cover them.
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
  const quickActions: IQuickAction[] = [
    {
      label: intl.formatMessage({ id: ETranslations.global_copy_url }),
      icon: 'Copy3Outline',
      onPress: () => onCopyUrl(),
      testID: 'action-list-item-copy',
    },
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
      // The system share sheet can only open once this menu is gone.
      afterClose: true,
      onPress: () => onShare(),
      testID: DiscoveryTestIDs.browserShareButton,
    },
    {
      label: intl.formatMessage({ id: ETranslations.explore_open_in_browser }),
      icon: 'CompassCircleOutline',
      onPress: () => onBrowserOpen(),
      testID: 'action-list-item-open-in-browser',
    },
  ];
  const sections: IActionListSection[] = [
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
          // Not styled destructive: closing a tab is routine and easy to
          // undo by reopening the site.
          onPress: runAfterMenuClose(onCloseTab),
          testID: DiscoveryTestIDs.tabActionClose,
        },
      ].filter(Boolean) as IActionListItemProps[],
    },
  ].filter((section) => section.items.length > 0);
  return { quickActions, sections };
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
    const { quickActions, sections } = buildOptionsSections(intl, {
      ...current,
      onGoForward: withMenuLog('forward', current.onGoForward),
      onTranslatePress: withMenuLog('translate', current.onTranslatePress),
      onShare: withMenuLog('share', current.onShare),
      onCopyUrl: withMenuLog('copyUrl', current.onCopyUrl),
      onBrowserOpen: withMenuLog('openInBrowser', current.onBrowserOpen),
      onRequestSiteMode: withMenuLog('siteMode', current.onRequestSiteMode),
      // These also have their own events (addBookmark, pinTab, disconnect,
      // closeTab) that don't say where they came from; closeTab from the tab
      // list and from this menu even share closeMethod 'Menu'.
      onBookmarkPress: withMenuLog('bookmark', current.onBookmarkPress),
      onPinnedPress: withMenuLog('pin', current.onPinnedPress),
      onDisconnect: withMenuLog('disconnect', current.onDisconnect),
      onCloseTab: withMenuLog('closeTab', current.onCloseTab),
    });
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.explore_options }),
      renderItems: ({ handleActionListClose }) => (
        <OptionsMenuContent
          quickActions={quickActions}
          sections={sections}
          onClose={handleActionListClose}
        />
      ),
    });
  }, [intl]);
}
