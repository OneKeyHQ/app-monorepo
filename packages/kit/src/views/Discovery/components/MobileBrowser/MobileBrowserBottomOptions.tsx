import { type PropsWithChildren, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ESiteMode, type IMobileBottomOptionsProps } from '../../types';

function MobileBrowserBottomOptions({
  children,
  disabled,
  isBookmark,
  onBookmarkPress,
  onRefresh,
  onShare,
  onCopyUrl,
  isPinned,
  onPinnedPress,
  onBrowserOpen,
  onCloseTab,
  onGoBackHomePage,
  displayDisconnectOption,
  onDisconnect,
  siteMode,
  onRequestSiteMode,
}: PropsWithChildren<IMobileBottomOptionsProps>) {
  const intl = useIntl();
  const actionSectionItems = useMemo(
    () => [
      {
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.explore_reload }),
            icon: 'RotateClockwiseOutline',
            onPress: onRefresh,
            testID: 'action-list-item-reload',
          },
          {
            label: intl.formatMessage({
              id: isBookmark
                ? ETranslations.explore_remove_bookmark
                : ETranslations.explore_add_bookmark,
            }),
            icon: isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => onBookmarkPress(!isBookmark),
            testID: `action-list-item-${
              !isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
          },
          {
            label: intl.formatMessage({
              id: isPinned
                ? ETranslations.explore_unpin
                : ETranslations.explore_pin,
            }),
            icon: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress(!isPinned),
            testID: `action-list-item-${!isPinned ? 'pin' : 'un-pin'}`,
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
            label: intl.formatMessage({ id: ETranslations.global_copy_url }),
            icon: 'LinkOutline',
            onPress: () => {
              onCopyUrl();
            },
            testID: `action-list-item-copy`,
          },
          {
            label: intl.formatMessage({ id: ETranslations.explore_share }),
            icon: 'ShareOutline',
            onPress: () => onShare(),
            testID: 'action-list-item-share',
          },
        ].filter(Boolean) as IActionListItemProps[],
      },
      {
        items: [
          displayDisconnectOption && {
            label: intl.formatMessage({ id: ETranslations.explore_disconnect }),
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
            onPress: onCloseTab,
            testID: 'action-list-item-close-tab-in-browser',
          },
          platformEnv.isNativeIOSPad && onGoBackHomePage
            ? {
                label: intl.formatMessage({
                  id: ETranslations.explore_back_to_home,
                }),
                icon: 'HomeOpenOutline',
                onPress: onGoBackHomePage,
                testID: 'action-list-item-back-to-home',
              }
            : undefined,
        ].filter(Boolean) as IActionListItemProps[],
      },
    ],
    [
      intl,
      onRefresh,
      isBookmark,
      isPinned,
      siteMode,
      displayDisconnectOption,
      onDisconnect,
      onCloseTab,
      onGoBackHomePage,
      onBookmarkPress,
      onPinnedPress,
      onRequestSiteMode,
      onBrowserOpen,
      onCopyUrl,
      onShare,
    ],
  );
  return (
    <ActionList
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      renderTrigger={children}
      disabled={disabled}
      sections={actionSectionItems}
    />
  );
}

export default MobileBrowserBottomOptions;
