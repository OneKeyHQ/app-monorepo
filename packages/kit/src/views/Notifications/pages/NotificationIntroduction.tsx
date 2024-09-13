import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Heading,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INotificationPermissionDetail } from '@onekeyhq/shared/types/notification';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

import NotificationIntroIllustration from '../components/NotificationIntroIllustration';

function NotificationIntroduction() {
  const intl = useIntl();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const isEnablePermissionCalled = useRef(false);
  const isFocused = useRouteIsFocused();
  const navigation = useAppNavigation();

  const canAutoCloseWhenGranted = useMemo(() => {
    if (platformEnv.isNativeIOS || platformEnv.isExtension) {
      return true;
    }
    return false;
  }, []);

  const shouldShowCancelButton = !canAutoCloseWhenGranted;

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
          <Heading size="$heading3xl" textAlign="center">
            {intl.formatMessage({ id: ETranslations.global_notifications })}
          </Heading>
          <SizableText color="$textSubdued" textAlign="center">
            {intl.formatMessage({ id: ETranslations.notifications_intro_desc })}
          </SizableText>
        </Stack>
        <NotificationIntroIllustration />
        {/* Mac tutorials */}
        {platformEnv.isDesktopMac ? (
          <YStack
            gap="$2"
            w="100%"
            maxWidth="$96"
            mx="auto"
            p="$2"
            bg="$bgSubdued"
            borderRadius="$3"
            outlineColor="$neutral3"
            outlineWidth={1}
            outlineStyle="solid"
            elevation={0.5}
          >
            <XStack
              gap="$2"
              p="$2"
              bg="$neutral2"
              outlineColor="$neutral3"
              outlineWidth={1}
              outlineStyle="solid"
              borderRadius="$2"
              elevation={10}
            >
              <Image
                source={require('@onekeyhq/kit/assets/logo-decorated.png')}
                w="$8"
                h="$8"
              />
              <Stack flex={1}>
                <Heading size="$bodyMd">Allow notifications</Heading>
                <SizableText size="$bodySm" color="$textSubdued">
                  OneKey
                </SizableText>
              </Stack>
              <Switch value size="small" />
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.notifications_intro_mac_desc,
              })}
            </SizableText>
            <Icon
              name="HandDrawRightDownArrowIllus"
              color="$text"
              position="absolute"
              bottom="$-10"
              right={-56}
              w="$10"
              h="$24"
            />
          </YStack>
        ) : null}
      </Page.Body>

      <Page.Footer
        confirmButtonProps={{
          loading: confirmLoading,
        }}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_enable })}
        onConfirm={async (close) => {
          try {
            setConfirmLoading(true);
            isEnablePermissionCalled.current = true;
            await backgroundApiProxy.serviceNotification.enableNotificationPermissions();
          } finally {
            setConfirmLoading(false);
          }
        }}
        {...(shouldShowCancelButton && {
          onCancelText: intl.formatMessage({ id: ETranslations.global_done }),
          onCancel: () => console.log('clicked'),
        })}
      />
    </Page>
  );
}

export default NotificationIntroduction;
