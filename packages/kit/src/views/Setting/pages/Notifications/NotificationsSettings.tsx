import { useCallback, useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Divider,
  LinearGradient,
  Page,
  SizableText,
  Spinner,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { showNotificationPermissionsDialog } from '@onekeyhq/kit/src/components/PermissionsDialog';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDevSettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import type { INotificationPushSettings } from '@onekeyhq/shared/types/notification';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import NotificationIntroIllustration from '../../../Notifications/components/NotificationIntroIllustration';

export default function NotificationsSettings() {
  const intl = useIntl();
  const [settings, setSettings] = useState<
    INotificationPushSettings | undefined
  >();
  const [devAppSettings] = useDevSettingsPersistAtom();
  const [appSettings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();

  const prevSettings = useRef<INotificationPushSettings | undefined>();

  const { result: pushClient } = usePromiseResult(() => {
    noop(devAppSettings.enabled);
    return backgroundApiProxy.serviceNotification.getPushClient();
  }, [devAppSettings.enabled]);

  const reloadSettings = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceNotification.fetchNotificationSettings();
    setSettings(result);
    prevSettings.current = result;
  }, []);

  const updateSettingsToServer = useDebouncedCallback(
    async (partSettings: INotificationPushSettings) => {
      let updated = false;
      try {
        updated =
          await backgroundApiProxy.serviceNotification.updateNotificationSettings(
            {
              ...settings,
              ...partSettings,
            },
          );
      } catch (e) {
        if (prevSettings.current) {
          setSettings(prevSettings.current);
        }
        throw e;
      }
      if (updated) {
        await reloadSettings();
      }
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  const updateSettings = useCallback(
    async (partSettings: INotificationPushSettings) => {
      setSettings((v) => ({
        ...v,
        ...partSettings,
      }));
      void updateSettingsToServer(partSettings);
    },
    [updateSettingsToServer],
  );

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
      />
      <Page.Body>
        {!settings ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <>
            <ListItem>
              <ListItem.Text
                flex={1}
                primary={intl.formatMessage({
                  id: ETranslations.notifications_notifications_switch_label,
                })}
                primaryTextProps={{
                  size: '$headingMd',
                }}
              />
              <Switch
                value={!!settings?.pushEnabled}
                onChange={(checked) => {
                  void updateSettings({
                    pushEnabled: checked,
                  });
                }}
              />
            </ListItem>

            {settings?.pushEnabled ? (
              <>
                <Divider m="$5" />
                <ListItem>
                  <ListItem.Text
                    flex={1}
                    primary={intl.formatMessage({
                      id: ETranslations.notifications_notifications_account_activity_label,
                    })}
                    secondary={intl.formatMessage({
                      id: ETranslations.notifications_notifications_account_activity_desc,
                    })}
                    secondaryTextProps={{
                      maxWidth: '$96',
                    }}
                  />
                  <Switch
                    value={!!settings?.accountActivityPushEnabled}
                    onChange={(checked) => {
                      void updateSettings({
                        accountActivityPushEnabled: checked,
                      });
                    }}
                  />
                </ListItem>
                {/* <ListItem>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage({
              id: ETranslations.notifications_notifications_price_alert_label,
            })}
            secondary={intl.formatMessage({
              id: ETranslations.notifications_notifications_price_alert_desc,
            })}
            secondaryTextProps={{
              maxWidth: '$96',
            }}
          />
          <Switch value />
        </ListItem> */}
              </>
            ) : null}
          </>
        )}

        {/* {devAppSettings?.enabled ? (
          <Stack px="$5">
            <Button onPress={showNotificationPermissionsDialog}>
              通知权限
            </Button>
            <Button
              onPress={() => {
                navigation.pushModal(EModalRoutes.NotificationsModal, {
                  screen: EModalNotificationsRoutes.NotificationIntroduction,
                });
              }}
            >
              初次引导
            </Button>
            <SizableText>
              InstanceId: {appSettings?.instanceId?.slice(0, 8)}...
            </SizableText>
            <SizableText>
              JPush: {pushClient?.jpushId?.slice(0, 8)}...
            </SizableText>
            <SizableText>
              WebSocket: {pushClient?.socketId?.slice(0, 8)}...
            </SizableText>
          </Stack>
        ) : null} */}

        <Stack
          gap="$8"
          px="$5"
          mt="$5"
          pt="$8"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderColor="$border"
        >
          <LinearGradient
            zIndex={0}
            position="absolute"
            top={0}
            left={0}
            right={0}
            h="$10"
            colors={['$neutral3', '$transparent']}
            $platform-native={{
              display: 'none',
            }}
          />
          <Stack
            zIndex={1}
            gap="$2"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: '$10',
            }}
          >
            <Stack
              gap="$2"
              $gtMd={{
                flex: 1,
              }}
            >
              <SizableText size="$bodyMdMedium">
                Enable push notifications
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                Enable notifications for OneKey in your device settings for
                faster, easier alerts. Tap the button below to test permissions,
                or visit our Help Center if issues arise.
              </SizableText>
            </Stack>
            <Button size="small" alignSelf="flex-start">
              Test push notifications
            </Button>
          </Stack>
          <NotificationIntroIllustration />
        </Stack>
      </Page.Body>
    </Page>
  );
}
