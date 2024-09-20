import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Heading, Page, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INotificationPermissionDetail } from '@onekeyhq/shared/types/notification';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import EnablePushNotificationsTutorial from '../components/EnablePushNotificationsTutorial';
import NotificationIntroIllustration from '../components/NotificationIntroIllustration';

function NotificationIntroduction() {
  const intl = useIntl();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const isEnablePermissionCalled = useRef(false);
  const isFocused = useRouteIsFocused();
  const navigation = useAppNavigation();

  const canAutoCloseWhenGranted = useMemo(() => {
    if (
      platformEnv.isNativeIOS ||
      platformEnv.isExtension ||
      platformEnv.isNativeAndroid
    ) {
      return true;
    }
    return false;
  }, []);

  const shouldShowCancelButton =
    !canAutoCloseWhenGranted ||
    platformEnv.isNativeAndroid ||
    platformEnv.isExtension;

  const checkShouldClose = useCallback(
    (permission: INotificationPermissionDetail) =>
      canAutoCloseWhenGranted &&
      permission.isSupported &&
      permission.permission === ENotificationPermission.granted,
    [canAutoCloseWhenGranted],
  );

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isEnablePermissionCalled.current || !canAutoCloseWhenGranted) {
        return;
      }
      const permission =
        await backgroundApiProxy.serviceNotification.getPermissionWithoutLog();
      if (checkShouldClose(permission)) {
        navigation.pop();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [navigation, canAutoCloseWhenGranted, checkShouldClose]);

  return (
    <Page>
      <Page.Header />
      <Page.Body flex={1} gap="$8" px="$5" justifyContent="center">
        <Stack gap="$2" w="100%" maxWidth="$96" mx="auto">
          <Heading size="$heading2xl" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.notifications_intro_title,
            })}
          </Heading>
          <SizableText color="$textSubdued" textAlign="center">
            {intl.formatMessage({ id: ETranslations.notifications_intro_desc })}
          </SizableText>
        </Stack>
        <NotificationIntroIllustration />
        <EnablePushNotificationsTutorial />
      </Page.Body>

      <Page.Footer
        {...(!platformEnv.isExtension && {
          confirmButtonProps: {
            loading: confirmLoading,
          },
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onConfirm: async (close) => {
            try {
              setConfirmLoading(true);
              await backgroundApiProxy.serviceNotification.enableNotificationPermissions();
            } finally {
              setConfirmLoading(false);
              isEnablePermissionCalled.current = true;
            }
          },
        })}
        {...(shouldShowCancelButton && {
          onCancelText: intl.formatMessage({ id: ETranslations.global_done }),
          onCancel: (close) => {
            void close();
          },
        })}
      />
    </Page>
  );
}

export default NotificationIntroduction;
