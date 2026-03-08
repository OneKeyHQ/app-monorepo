import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IIconButtonProps } from '@onekeyhq/components';
import {
  Popover,
  Tooltip,
  useIsDesktopModeUIInTabPages,
} from '@onekeyhq/components';
import { HeaderNotificationButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { NotificationListViewPopover } from '../../../views/Notifications/components/NotificationListView';

export interface IHeaderNotificationIconButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
  testID?: string;
}

export function HeaderNotificationIconButton({
  size,
  iconSize,
  testID,
}: IHeaderNotificationIconButtonProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();

  const notificationBadge = useMemo(
    () => ({
      show: !firstTimeGuideOpened || !!badge,
      count: firstTimeGuideOpened ? badge : undefined,
    }),
    [firstTimeGuideOpened, badge],
  );

  const handleNotificationPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  const isDesktopModeUI = useIsDesktopModeUIInTabPages();

  return isDesktopModeUI ? (
    <Popover
      title=""
      showHeader={false}
      placement="bottom-end"
      offset={6}
      keepChildrenMounted
      renderTrigger={
        <Tooltip
          placement="bottom"
          renderTrigger={
            <HeaderNotificationButton
              size={size}
              iconSize={iconSize}
              showBadge={notificationBadge.show}
              badgeCount={notificationBadge.count}
              testID={testID ?? 'dex-notification-button'}
            />
          }
          renderContent={intl.formatMessage({
            id: ETranslations.global_notifications,
          })}
        />
      }
      floatingPanelProps={{
        width: 434,
        maxWidth: 434,
        height: 592,
        px: 0,
        overflow: 'hidden',
      }}
      renderContent={
        <NotificationListViewPopover
          showPageHeader={false}
          containerStyle={{ width: 434, maxWidth: 434, height: 592 }}
        />
      }
    />
  ) : (
    <HeaderNotificationButton
      size={size}
      iconSize={iconSize}
      showBadge={notificationBadge.show}
      badgeCount={notificationBadge.count}
      onPress={handleNotificationPress}
      testID={testID ?? 'dex-notification-button'}
    />
  );
}
