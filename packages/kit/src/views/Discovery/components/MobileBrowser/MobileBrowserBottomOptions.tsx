import { type PropsWithChildren, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';

import type { IMobileBottomOptionsProps } from '../../types';

function MobileBrowserBottomOptions({
  children,
  disabled,
  isBookmark,
  onBookmarkPress,
  onRefresh,
  onShare,
  isPinned,
  onPinnedPress,
  onBrowserOpen,
  onCloseTab,
  onGoBackHomePage,
  displayDisconnectOption,
  onDisconnect,
}: PropsWithChildren<IMobileBottomOptionsProps>) {
  const intl = useIntl();
  const buildSectionItems = useCallback(
    () =>
      [
        {
          label: intl.formatMessage({ id: 'action__refresh' }),
          icon: 'RotateClockwiseOutline',
          onPress: () => onRefresh(),
          testID: 'action-list-item-reload',
        },
        {
          label: intl.formatMessage({
            id: isBookmark ? 'actionn__remove_bookmark' : 'actionn__bookmark',
          }),
          icon: isBookmark ? 'StarSolid' : 'StarOutline',
          onPress: () => onBookmarkPress(!isBookmark),
          testID: `action-list-item-${
            !isBookmark ? 'bookmark' : 'remove-bookmark'
          }`,
        },
        {
          label: intl.formatMessage({
            id: isPinned ? 'action__unpin' : 'action__pin',
          }),
          icon: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
          onPress: () => onPinnedPress(!isPinned),
          testID: `action-list-item-${!isPinned ? 'pin' : 'un-pin'}`,
        },
        {
          label: intl.formatMessage({ id: 'action__share' }),
          icon: 'ShareOutline',
          onPress: () => onShare(),
          testID: 'action-list-item-share',
        },
        {
          label: intl.formatMessage({ id: 'action__open_in_browser' }),
          icon: 'CompassCircleOutline',
          onPress: () => onBrowserOpen(),
          testID: 'action-list-item-open-in-browser',
        },
        displayDisconnectOption && {
          label: intl.formatMessage({ id: 'action__disconnect' }),
          icon: 'CompassCircleOutline',
          onPress: () => onDisconnect(),
          testID: 'action-list-item-disconnect-in-browser',
        },
        {
          label: intl.formatMessage({
            id: isPinned ? 'action__close_pin_tab' : 'form__close_tab',
          }),
          icon: 'CrossedLargeOutline',
          onPress: () => onCloseTab(),
          testID: 'action-list-item-close-tab-in-browser',
        },
      ].filter(Boolean) as IActionListItemProps[],
    [
      displayDisconnectOption,
      intl,
      isBookmark,
      isPinned,
      onCloseTab,
      onBookmarkPress,
      onBrowserOpen,
      onDisconnect,
      onPinnedPress,
      onRefresh,
      onShare,
    ],
  );
  return (
    <ActionList
      title={intl.formatMessage({ id: 'select__options' })}
      renderTrigger={children}
      disabled={disabled}
      sections={[
        {
          items: buildSectionItems(),
        },
        {
          items: [
            {
              label: intl.formatMessage({ id: 'action__back_to_home_page' }),
              icon: 'HomeOpenOutline',
              onPress: () => onGoBackHomePage(),
              testID: 'action-list-item-back-to-home',
            },
          ],
        },
      ]}
    />
  );
}

export default MobileBrowserBottomOptions;
