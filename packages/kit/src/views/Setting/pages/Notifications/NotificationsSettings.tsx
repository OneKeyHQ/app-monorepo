import { useCallback, useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Divider,
  Page,
  SizableText,
  Spinner,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { showNotificationPermissionsDialog } from '@onekeyhq/kit/src/components/PermissionsDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDevSettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import type { INotificationPushSettings } from '@onekeyhq/shared/types/notification';

import NotificationsHelpCenterInstruction from '../../components/NotificationsHelpCenterInstruction';
import NotificationsTestButton from '../../components/NotificationsTestButton';

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

  const reloadSettings = useCallback(
    async (updated?: INotificationPushSettings) => {
      const result =
        updated ||
        (await backgroundApiProxy.serviceNotification.fetchNotificationSettings());
      setSettings(result);
      prevSettings.current = result;
    },
    [],
  );

  const isUpdating = useRef(false);
  const updateSettingsToServer = useDebouncedCallback(
    async (partSettings: INotificationPushSettings) => {
      if (isUpdating.current) {
        return;
      }
      isUpdating.current = true;
      let updated: INotificationPushSettings | undefined;
      try {
        updated =
          await backgroundApiProxy.serviceNotification.updateNotificationSettings(
            {
              ...settings,
              ...partSettings,
            },
          );
        await reloadSettings(updated);
      } catch (e) {
        if (prevSettings.current) {
          setSettings(prevSettings.current);
        }
        throw e;
      } finally {
        isUpdating.current = false;
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
      setSettings((v) => {
        const newValue = {
          ...v,
          ...partSettings,
        };
        void updateSettingsToServer(newValue);
        return newValue;
      });
    },
    [updateSettingsToServer],
  );

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  return (
    <Page scrollEnabled skipLoading>
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
                {settings?.accountActivityPushEnabled ? (
                  <ListItem
                    title={intl.formatMessage({
                      id: ETranslations.notifications_notifications_account_manage_label,
                    })}
                    subtitle={intl.formatMessage({
                      id: ETranslations.notifications_notifications_account_manage_desc,
                    })}
                    drillIn
                    onPress={() => {
                      navigation.push(
                        EModalSettingRoutes.SettingManageAccountActivity,
                      );
                    }}
                  />
                ) : null}
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
                <Divider m="$5" />
                <ListItem>
                  <ListItem.Text
                    flex={1}
                    gap="$2"
                    primary={intl.formatMessage({
                      id: ETranslations.notifications_settings_helper_title,
                    })}
                    secondary={
                      <>
                        <SizableText
                          maxWidth="$96"
                          size="$bodyMd"
                          color="$textSubdued"
                        >
                          {intl.formatMessage({
                            id: ETranslations.notifications_settings_helper_desc,
                          })}
                        </SizableText>
                        <NotificationsHelpCenterInstruction />
                      </>
                    }
                  />
                  <NotificationsTestButton />
                </ListItem>
              </>
            ) : null}
          </>
        )}

        {devAppSettings?.enabled && platformEnv.isDev ? (
          <Stack p="$5" m="$5" borderRadius="$3" gap="$2" bg="$bgSubdued">
            <SizableText>Dev tools</SizableText>
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
        ) : null}
      </Page.Body>
    </Page>
  );
}
