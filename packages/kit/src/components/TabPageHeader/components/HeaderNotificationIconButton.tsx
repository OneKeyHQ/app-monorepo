import { useCallback, useMemo } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderNotificationButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';

import useAppNavigation from '../../../hooks/useAppNavigation';

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

  const handleNotificationPress = useCallback(async () => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  return (
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
