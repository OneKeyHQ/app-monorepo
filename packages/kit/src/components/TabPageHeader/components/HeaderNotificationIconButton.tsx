import { useCallback, useMemo } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import {
  Tooltip,
  YStack,
  useIsDesktopModeUIInTabPages,
} from '@onekeyhq/components';
import { HeaderNotificationButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { NotificationListView } from '../../../views/Notifications/components/NotificationListView';

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
    <Tooltip
      hovering
      placement="bottom-end"
      offset={{ mainAxis: 6, crossAxis: -28 }}
      renderTrigger={
        <HeaderNotificationButton
          size={size}
          iconSize={iconSize}
          showBadge={notificationBadge.show}
          badgeCount={notificationBadge.count}
          testID={testID ?? 'dex-notification-button'}
        />
      }
      contentProps={{
        width: 434,
        maxWidth: 434,
        height: 592,
        px: 0,
      }}
      renderContent={<NotificationListView showPageHeader={false} />}
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
