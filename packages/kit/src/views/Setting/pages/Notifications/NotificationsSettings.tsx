import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Divider,
  Page,
  Spinner,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { showNotificationPermissionsDialog } from '@onekeyhq/kit/src/components/PermissionsDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INotificationPushSettings } from '@onekeyhq/shared/types/notification';

export default function NotificationsSettings() {
  const intl = useIntl();
  const [settings, setSettings] = useState<
    INotificationPushSettings | undefined
  >();

  const prevSettings = useRef<INotificationPushSettings | undefined>();

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
    <Page>
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
                <Button onPress={showNotificationPermissionsDialog}>
                  通知权限
                </Button>
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
      </Page.Body>
    </Page>
  );
}
