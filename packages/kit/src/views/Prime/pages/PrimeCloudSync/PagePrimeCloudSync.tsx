import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  Dialog,
  ESwitchSize,
  Empty,
  HeaderIconButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Switch,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDistanceToNow } from '@onekeyhq/shared/src/utils/dateUtils';
import { isNeverLockDuration } from '@onekeyhq/shared/src/utils/passwordUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import { AppAutoLockSettingsView } from '../../../Setting/pages/AppAutoLock';

function isAutoLockValueNotAllowed(value: number) {
  return isNeverLockDuration(value) || value === Number(ELockDuration.Hour4);
}

function formatSyncLastUpdateTime(syncTime?: number): string {
  if (syncTime) {
    return formatDistanceToNow(new Date(syncTime));
  }
  return ' - ';
}

function AutoLockUpdateDialogContent({
  onContinue,
  onError,
}: {
  onContinue: () => void;
  onError: (error: Error) => void;
}) {
  const intl = useIntl();
  const [selectedValue, setSelectedValue] = useState<string>('');
  return (
    <Stack>
      <ScrollView h={250} nestedScrollEnabled>
        <SizableText px="$5">
          {intl.formatMessage({
            id: ETranslations.prime_auto_lock_description,
          })}
        </SizableText>
        <AppAutoLockSettingsView
          disableCloudSyncDisallowedOptions
          useLocalState
          onValueChange={(v) => {
            setSelectedValue(v);
          }}
        />
      </ScrollView>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          disabled: isAutoLockValueNotAllowed(Number(selectedValue)),
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        onConfirm={async () => {
          try {
            startViewTransition(async () => {
              await backgroundApiProxy.servicePassword.setAppLockDuration(
                Number(selectedValue),
              );
            });
            onContinue();
          } catch (error) {
            onError(error as Error);
            throw error;
          }
        }}
      />
    </Stack>
  );
}

function AppDataSection() {
  const forceReloadServerUserInfo = useRef(false);

  const [config] = usePrimeCloudSyncPersistAtom();
  const isSubmittingRef = useRef(false);
  const manualSyncingRef = useRef(false);

  const intl = useIntl();

  // Scenario derivation
  const isActiveIdUser = !!config.isCloudSyncEnabled;
  const isActiveKwUser =
    !!config.isCloudSyncEnabledKeyless && !config.isCloudSyncEnabled;
  const isSyncOff =
    !config.isCloudSyncEnabled && !config.isCloudSyncEnabledKeyless;

  // Last update times
  const shouldUseLegacyLastSyncTime =
    !config.lastSyncTimeOneKeyId && !config.lastSyncTimeKeyless;

  const oneKeyIdLastUpdateTime = useMemo<string>(() => {
    const syncTime = shouldUseLegacyLastSyncTime
      ? config.lastSyncTime
      : config.lastSyncTimeOneKeyId;
    return formatSyncLastUpdateTime(syncTime);
  }, [
    config.lastSyncTime,
    config.lastSyncTimeOneKeyId,
    shouldUseLegacyLastSyncTime,
  ]);

  const keylessLastUpdateTime = useMemo<string>(() => {
    const syncTime = shouldUseLegacyLastSyncTime
      ? config.lastSyncTime
      : config.lastSyncTimeKeyless;
    return formatSyncLastUpdateTime(syncTime);
  }, [
    config.lastSyncTime,
    config.lastSyncTimeKeyless,
    shouldUseLegacyLastSyncTime,
  ]);

  const [passwordSettings] = usePasswordPersistAtom();
  const shouldChangePasswordAutoLock = useMemo(
    () =>
      passwordSettings.isPasswordSet &&
      isAutoLockValueNotAllowed(passwordSettings.appLockDuration),
    [passwordSettings.appLockDuration, passwordSettings.isPasswordSet],
  );

  const reloadServerUserInfo = useCallback(async () => {
    await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
  }, []);

  useEffect(() => {
    void reloadServerUserInfo();
  }, [reloadServerUserInfo]);

  // --- Handlers ---

  // Enable Keyless (Scenario 1 → Scenario 3)
  const handleEnableKeyless = useCallback(async () => {
    if (isSubmittingRef.current) return;
    try {
      isSubmittingRef.current = true;
      await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless({
        enabled: true,
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, []);

  // Migrate ID → Keyless (Scenario 2 → Scenario 3)
  const handleMigrateToKeyless = useCallback(() => {
    Dialog.show({
      title: 'Switch to Keyless Sync?',
      description:
        'Your synced data will be re-encrypted with your wallet key. OneKey ID sync will be turned off.',
      onConfirmText: 'Switch',
      onConfirm: async () => {
        await backgroundApiProxy.serviceApp.showDialogLoading({
          title: intl.formatMessage({
            id: ETranslations.global_syncing,
          }),
        });
        try {
          await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
            enabled: false,
          });
          await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless(
            { enabled: true },
          );
          await backgroundApiProxy.servicePrimeCloudSync.updateLastSyncTime({
            syncMode: ECloudSyncMode.Keyless,
          });
        } finally {
          await timerUtils.wait(1000);
          await backgroundApiProxy.serviceApp.hideDialogLoading();
        }
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: 'Switched to Keyless sync',
        });
      },
    });
  }, [intl]);

  // Toggle ID sync (Scenario 2)
  const handleToggleIdSync = useCallback(
    async (value: boolean) => {
      if (isSubmittingRef.current) return;
      try {
        isSubmittingRef.current = true;
        if (value && shouldChangePasswordAutoLock) {
          await new Promise<void>((resolve, reject) => {
            Dialog.show({
              isAsync: true,
              disableDrag: true,
              dismissOnOverlayPress: true,
              title: intl.formatMessage({
                id: ETranslations.settings_auto_lock,
              }),
              contentContainerProps: { px: 0 },
              onClose: () => reject(new Error('User cancelled')),
              onCancel: () => reject(new Error('User cancelled')),
              renderContent: (
                <AutoLockUpdateDialogContent
                  onContinue={() => resolve()}
                  onError={(error) => reject(error)}
                />
              ),
            });
          });
        }
        await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
          enabled: value,
        });
        defaultLogger.prime.usage.onekeyCloudToggle({
          status: value ? 'on' : 'off',
        });
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [intl, shouldChangePasswordAutoLock],
  );

  // Toggle Keyless sync (Scenario 3)
  const handleToggleKeylessSync = useCallback(async (value: boolean) => {
    if (isSubmittingRef.current) return;
    try {
      isSubmittingRef.current = true;
      await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless({
        enabled: value,
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, []);

  // Manual sync ID (Scenario 2)
  const handleManualSyncOneKeyId = useCallback(async () => {
    if (!config.isCloudSyncEnabled) return;
    if (manualSyncingRef.current) return;
    manualSyncingRef.current = true;
    try {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });
      await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow({
        callerName: 'Manual Cloud Sync OneKey ID',
        noDebounceUpload: true,
      });
      await backgroundApiProxy.servicePrimeCloudSync.updateLastSyncTime({
        syncMode: ECloudSyncMode.OnekeyId,
      });
    } finally {
      manualSyncingRef.current = false;
      await timerUtils.wait(1000);
      await backgroundApiProxy.serviceApp.hideDialogLoading();
    }
    void backgroundApiProxy.serviceApp.showToast({
      method: 'success',
      title: intl.formatMessage({
        id: ETranslations.global_sync_successfully,
      }),
    });
  }, [config.isCloudSyncEnabled, intl]);

  // Manual sync Keyless (Scenario 3)
  const handleManualSyncKeyless = useCallback(async () => {
    if (!config.isCloudSyncEnabledKeyless) return;
    if (manualSyncingRef.current) return;
    manualSyncingRef.current = true;
    try {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });
      await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow({
        callerName: 'Manual Cloud Sync Keyless',
        noDebounceUpload: true,
      });
      await backgroundApiProxy.servicePrimeCloudSync.updateLastSyncTime({
        syncMode: ECloudSyncMode.Keyless,
      });
    } finally {
      manualSyncingRef.current = false;
      await timerUtils.wait(1000);
      await backgroundApiProxy.serviceApp.hideDialogLoading();
    }
    void backgroundApiProxy.serviceApp.showToast({
      method: 'success',
      title: intl.formatMessage({
        id: ETranslations.global_sync_successfully,
      }),
    });
  }, [config.isCloudSyncEnabledKeyless, intl]);

  return (
    <>
      {/* Scenario 1: Sync Off — empty state */}
      {isSyncOff ? (
        <Empty
          icon="CloudOutline"
          title="Sync your data across devices"
          description="Wallet names, bookmarks, and settings — end-to-end encrypted."
          buttonProps={{
            children: 'Enable Cloud Sync',
            onPress: handleEnableKeyless,
          }}
        />
      ) : null}

      {/* Scenario 2: Active ID User — migration alert + ID controls */}
      {isActiveIdUser ? (
        <>
          <Alert
            type="info"
            title="Upgrade to Keyless Sync"
            description="OneKey ID sync will be discontinued. Keyless sync is simpler — no account needed."
            action={{
              primary: 'Switch Now',
              onPrimaryPress: handleMigrateToKeyless,
            }}
            mx="$5"
            mb="$3"
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_onekey_cloud,
            })}
            icon="CloudOutline"
            subtitle={`${intl.formatMessage({
              id: ETranslations.prime_last_update,
            })} : ${oneKeyIdLastUpdateTime}`}
          >
            <Badge badgeSize="sm" badgeType="default">
              <Badge.Text>OneKey ID</Badge.Text>
            </Badge>
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleIdSync}
              value={config.isCloudSyncEnabled}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.wallet_backup_now,
            })}
            icon="RefreshCwOutline"
            drillIn
            onPress={handleManualSyncOneKeyId}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.prime_change_backup_password,
            })}
            icon="Key2Outline"
            drillIn
            onPress={async () => {
              try {
                await backgroundApiProxy.serviceMasterPassword.startChangePassword();
              } finally {
                forceReloadServerUserInfo.current = true;
                await reloadServerUserInfo();
              }
            }}
          />
        </>
      ) : null}

      {/* Scenario 3: Active KW User — switch + backup */}
      {isActiveKwUser ? (
        <>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_onekey_cloud,
            })}
            icon="CloudOutline"
            subtitle={`${intl.formatMessage({
              id: ETranslations.prime_last_update,
            })} : ${keylessLastUpdateTime}`}
          >
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleKeylessSync}
              value={!!config.isCloudSyncEnabledKeyless}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.wallet_backup_now,
            })}
            icon="RefreshCwOutline"
            drillIn
            onPress={handleManualSyncKeyless}
          />
        </>
      ) : null}
    </>
  );
}

export default function PagePrimeCloudSync() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync.showAlertDialogIfLocalPasswordNotSet();
  }, []);

  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="QuestionmarkOutline"
        onPress={() => {
          navigation.navigate(EPrimePages.PrimeCloudSyncInfo);
        }}
      />
    ),
    [navigation],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <AppDataSection />
        <MultipleClickStack
          onPress={() => {
            navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
          }}
        >
          <Stack h="$32" />
        </MultipleClickStack>
      </Page.Body>
    </Page>
  );
}
