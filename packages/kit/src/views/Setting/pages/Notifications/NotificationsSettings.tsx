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
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { showNotificationPermissionsDialog } from '@onekeyhq/kit/src/components/PermissionsDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDevSettingsPersistAtom,
  useNotificationsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ENotificationPermission,
  type INotificationPushSettings,
} from '@onekeyhq/shared/types/notification';

import NotificationsHelpCenterInstruction from '../../components/NotificationsHelpCenterInstruction';
import NotificationsTestButton from '../../components/NotificationsTestButton';

function NotificationSettingsSectionTitle({ title }: { title: string }) {
  return (
    <SizableText px="$5" pt="$5" pb="$2" size="$headingXs" color="$textSubdued">
      {title}
    </SizableText>
  );
}

export default function NotificationsSettings() {
  const intl = useIntl();
  const [settings, setSettings] = useState<
    INotificationPushSettings | undefined
  >();
  const [devAppSettings] = useDevSettingsPersistAtom();
  const [appSettings] = useSettingsPersistAtom();
  const [, setNotificationsData] = useNotificationsAtom();
  const navigation = useAppNavigation();

  const prevSettings = useRef<INotificationPushSettings>(undefined);
  const [shouldShowDevPanel, setShouldShowDevPanel] = useState(false);
  const pendingSettings = useRef<INotificationPushSettings | undefined>(
    undefined,
  );

  const { result: pushClient } = usePromiseResult(() => {
    noop(devAppSettings.enabled);
    return backgroundApiProxy.serviceNotification.getPushClient();
  }, [devAppSettings.enabled]);

  const reloadSettings = useCallback(
    async (updated?: INotificationPushSettings) => {
      const result =
        updated ||
        (await backgroundApiProxy.serviceNotification.fetchServerNotificationSettings());
      setSettings(result);
      prevSettings.current = result;
    },
    [],
  );

  const isUpdating = useRef(false);

  const doUpdateSettingsToServer = useCallback(async () => {
    if (isUpdating.current || !pendingSettings.current) {
      return;
    }
    isUpdating.current = true;
    const settingsToUpdate = pendingSettings.current;
    pendingSettings.current = undefined;

    try {
      const updated =
        await backgroundApiProxy.serviceNotification.updateServerNotificationSettings(
          settingsToUpdate,
        );
      // Check if there are new pending settings during the request
      if (pendingSettings.current) {
        // If there are new pending settings, continue updating
        isUpdating.current = false;
        void doUpdateSettingsToServer();
      } else {
        await reloadSettings(updated);
        isUpdating.current = false;
      }
    } catch (e) {
      isUpdating.current = false;
      if (prevSettings.current) {
        setSettings(prevSettings.current);
      }
      throw e;
    }
  }, [reloadSettings]);

  const updateSettingsToServer = useDebouncedCallback(
    () => {
      void doUpdateSettingsToServer();
    },
    2000,
    {
      leading: false,
      trailing: true,
    },
  );

  const updateSettings = useCallback(
    (partSettings: INotificationPushSettings) => {
      setSettings((v) => {
        const newValue = {
          ...v,
          ...partSettings,
        };
        pendingSettings.current = newValue;
        updateSettingsToServer();
        return newValue;
      });
    },
    [updateSettingsToServer],
  );

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  // Flush pending settings when component unmount
  useEffect(
    () => () => {
      if (pendingSettings.current) {
        updateSettingsToServer.flush();
      }
    },
    [updateSettingsToServer],
  );

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
                  id: ETranslations.notifications_settings_helper_title,
                })}
                secondary={intl.formatMessage({
                  id: ETranslations.global_master_switch_all_notification,
                })}
                secondaryTextProps={{
                  maxWidth: '$96',
                }}
              />
              <Switch
                testID="notification-setting-pushEnabled"
                size="small"
                value={!!settings?.pushEnabled}
                onChange={async (checked) => {
                  void updateSettings({
                    pushEnabled: checked,
                  });
                  if (checked) {
                    const permission =
                      await backgroundApiProxy.serviceNotification.getPermission();
                    await timerUtils.wait(300);
                    if (
                      permission.isSupported &&
                      permission.permission !== ENotificationPermission.granted
                    ) {
                      navigation.pushModal(EModalRoutes.NotificationsModal, {
                        screen:
                          EModalNotificationsRoutes.NotificationIntroduction,
                      });
                    }
                  }
                }}
              />
            </ListItem>

            {settings?.pushEnabled ? (
              <>
                <NotificationSettingsSectionTitle
                  title={intl.formatMessage({
                    id: ETranslations.notifications_notifications_account_activity_label,
                  })}
                />
                <ListItem>
                  <ListItem.Text
                    flex={1}
                    primary={intl.formatMessage({
                      id: ETranslations.wallet_activity__title,
                    })}
                    secondary={intl.formatMessage({
                      id: ETranslations.notifications_notifications_account_activity_desc,
                    })}
                    secondaryTextProps={{
                      maxWidth: '$96',
                    }}
                  />
                  <Switch
                    testID="notification-setting-accountActivityPushEnabled"
                    size="small"
                    value={!!settings?.accountActivityPushEnabled}
                    onChange={(checked) => {
                      void updateSettings({
                        accountActivityPushEnabled: checked,
                      });
                    }}
                  />
                </ListItem>

                <ListItem
                  testID="notification-accounts-row"
                  title={intl.formatMessage({
                    id: ETranslations.notification_accounts__action,
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

                <ListItem>
                  <ListItem.Text
                    flex={1}
                    primary={intl.formatMessage({
                      id: ETranslations.perps_alerts__title,
                    })}
                    secondary={intl.formatMessage({
                      id: ETranslations.global_update_perp_contract,
                    })}
                    secondaryTextProps={{
                      maxWidth: '$96',
                    }}
                  />
                  <Switch
                    testID="notification-setting-perpsEnabled"
                    size="small"
                    value={!!settings?.perpsEnabled}
                    onChange={(checked) => {
                      void updateSettings({
                        perpsEnabled: checked,
                      });
                    }}
                  />
                </ListItem>

                <Divider mx="$5" mt="$3" />
                <NotificationSettingsSectionTitle
                  title={intl.formatMessage({
                    id: ETranslations.alerts_and_updates__action,
                  })}
                />

                {platformEnv.isExtension ? null : (
                  <ListItem>
                    <ListItem.Text
                      flex={1}
                      primary={intl.formatMessage({
                        id: ETranslations.global_price_alerts,
                      })}
                      secondary={intl.formatMessage({
                        id: ETranslations.global_get_alert_token_move,
                      })}
                      secondaryTextProps={{
                        maxWidth: '$96',
                      }}
                    />
                    <Switch
                      testID="notification-setting-priceAlertsEnabled"
                      size="small"
                      value={!!settings?.priceAlertsEnabled}
                      onChange={(checked) => {
                        void updateSettings({
                          priceAlertsEnabled: checked,
                        });
                      }}
                    />
                  </ListItem>
                )}

                <ListItem>
                  <ListItem.Text
                    flex={1}
                    primary={intl.formatMessage({
                      id: ETranslations.important_notices__title,
                    })}
                    secondary={intl.formatMessage({
                      id: ETranslations.global_version_update_security_alert,
                    })}
                    secondaryTextProps={{
                      maxWidth: '$96',
                    }}
                  />
                  <Switch
                    testID="notification-setting-announcementEnabled"
                    size="small"
                    value={!!settings?.announcementEnabled}
                    onChange={(checked) => {
                      void updateSettings({
                        announcementEnabled: checked,
                      });
                    }}
                  />
                </ListItem>

                <ListItem>
                  <ListItem.Text
                    flex={1}
                    primary={intl.formatMessage({
                      id: ETranslations.product_and_market_updates__title,
                    })}
                    secondary={intl.formatMessage({
                      id: ETranslations.global_market_insights_tips,
                    })}
                    secondaryTextProps={{
                      maxWidth: '$96',
                    }}
                  />
                  <Switch
                    testID="notification-setting-dailyUpdateEnabled"
                    size="small"
                    value={!!settings?.dailyUpdateEnabled}
                    onChange={(checked) => {
                      void updateSettings({
                        dailyUpdateEnabled: checked,
                      });
                    }}
                  />
                </ListItem>

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
                  <NotificationsTestButton
                    showPermissionAction={platformEnv.isNativeIOS}
                  />
                </ListItem>
              </>
            ) : null}
          </>
        )}

        <MultipleClickStack
          h="$12"
          showDevBgColor
          onPress={() => {
            setShouldShowDevPanel(true);
          }}
        />

        {shouldShowDevPanel ? (
          <Stack p="$5" m="$5" borderRadius="$3" gap="$2" bg="$bgSubdued">
            <SizableText>Dev tools</SizableText>
            <Button
              onPress={showNotificationPermissionsDialog}
              testID="setting-btn"
            >
              通知权限
            </Button>
            <Button
              testID="setting-btn"
              onPress={() => {
                navigation.pushModal(EModalRoutes.NotificationsModal, {
                  screen: EModalNotificationsRoutes.NotificationIntroduction,
                });
              }}
            >
              初次引导
            </Button>
            <Button
              testID="setting-btn"
              onPress={() => {
                setNotificationsData((v) => ({
                  ...v,
                  txHistoryAlertDismissed: undefined,
                  swapHistoryAlertDismissed: undefined,
                  perpHistoryAlertDismissed: undefined,
                }));
              }}
            >
              重置所有 Alert 状态
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
