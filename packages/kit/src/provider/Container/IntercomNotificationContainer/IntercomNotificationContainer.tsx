import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Toast,
  rootNavigationRef,
  useOnRouterChange,
} from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  dismissIntercomNotification,
  getIntercomNotification,
  openIntercomNotification,
  refreshIntercomNotifications,
  setIntercomInAppMessageVisibility,
  subscribeToIntercomNotifications,
} from '@onekeyhq/shared/src/modules3rdParty/intercom';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

import { SupportUi } from './SupportUi';
import {
  type IIntercomNavigationState,
  shouldShowIntercomInAppMessages,
} from './visibility';

function updateVisibility(visible: boolean) {
  void setIntercomInAppMessageVisibility(visible).catch(() => {
    console.warn('Failed to update Intercom message visibility');
  });
}

export function IntercomNotificationContainer() {
  const intl = useIntl();
  const [isLocked] = useAppIsLockedAtom();
  const [isRouteAllowed, setIsRouteAllowed] = useState(false);
  const [foreground, setForeground] = useState(getCurrentVisibilityState);
  const notification = useSyncExternalStore(
    subscribeToIntercomNotifications,
    getIntercomNotification,
    getIntercomNotification,
  );
  useEffect(() => onVisibilityStateChange(setForeground), []);
  useEffect(() => {
    const onPush = ({ conversationId }: { conversationId?: string }) => {
      refreshIntercomNotifications(conversationId);
    };
    appEventBus.on(EAppEventBusNames.SupportConversationUpdated, onPush);
    return () => {
      appEventBus.off(EAppEventBusNames.SupportConversationUpdated, onPush);
    };
  }, []);
  const handleRouterChange = useCallback(
    (state: IIntercomNavigationState | undefined) => {
      setIsRouteAllowed(shouldShowIntercomInAppMessages(state));
    },
    [],
  );
  useOnRouterChange(handleRouterChange);

  useEffect(() => {
    const navigation = rootNavigationRef.current;
    if (!navigation) {
      return;
    }
    // useOnRouterChange syncs a ready container; this covers a later ready.
    return navigation.addListener('ready', () =>
      handleRouterChange(navigation.getRootState()),
    );
  }, [handleRouterChange]);

  const visible = foreground && !isLocked && isRouteAllowed;
  useLayoutEffect(() => {
    updateVisibility(visible);
    return () => updateVisibility(false);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !notification) return;
    let disposed = false;
    const open = () => {
      void openIntercomNotification(notification.id);
    };
    const support = intl.formatMessage({ id: ETranslations.global_support });
    const toast = Toast.notification({
      toastId: `support-${notification.id}`,
      title: notification.author
        ? `${support} · ${notification.author.slice(0, 80)}`
        : support,
      message: notification.message || undefined,
      icon: 'HelpSupportOutline',
      iconImageUri: notification.avatarUrl,
      duration: 10_000,
      onPress: open,
      onClose: () => {
        if (!disposed) dismissIntercomNotification(notification.id);
      },
      actions: (
        <Button
          testID="support-notification-open"
          size="small"
          variant="primary"
          onPress={open}
        >
          {intl.formatMessage({ id: ETranslations.global_view })}
        </Button>
      ),
      actionsAlign: 'left',
    });
    return () => {
      disposed = true;
      void toast?.close();
    };
  }, [intl, notification, visible]);

  return <SupportUi />;
}
