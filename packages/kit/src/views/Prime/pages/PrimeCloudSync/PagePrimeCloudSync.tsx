import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  ESwitchSize,
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
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  useDevSettingsPersistAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePrimeCloudSyncPersistAtom,
  usePrimeServerMasterPasswordStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDistanceToNow } from '@onekeyhq/shared/src/utils/dateUtils';
import { isNeverLockDuration } from '@onekeyhq/shared/src/utils/passwordUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import { AppAutoLockSettingsView } from '../../../Setting/pages/AppAutoLock';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

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

function EnableOneKeyCloudSwitchListItem({
  onManualSyncOneKeyId,
  onManualSyncKeyless,
}: {
  onManualSyncOneKeyId: () => Promise<void>;
  onManualSyncKeyless: () => Promise<void>;
}) {
  const [config] = usePrimeCloudSyncPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const { isPrimeSubscriptionActive } = useOneKeyAuth();
  const navigation = useAppNavigation();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeCloudSync>();
  const serverUserInfo = route.params?.serverUserInfo;

  const isSubmittingRef = useRef(false);

  const intl = useIntl();

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
  const { ensurePrimeSubscriptionActive } = usePrimeRequirements();

  const [passwordSettings] = usePasswordPersistAtom();
  const shouldChangePasswordAutoLock = useMemo(() => {
    return (
      passwordSettings.isPasswordSet &&
      isAutoLockValueNotAllowed(passwordSettings.appLockDuration)
    );
  }, [passwordSettings.appLockDuration, passwordSettings.isPasswordSet]);

  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const showKeylessCloudSync =
    devSettings.enabled &&
    !!devSettings.settings?.enableKeylessCloudSyncFeature;

  const onekeyIdSwitchItem = (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.global_onekey_cloud,
      })}
      icon="CloudOutline"
      subtitle={`${intl.formatMessage({
        id: ETranslations.prime_last_update,
      })} : ${oneKeyIdLastUpdateTime}`}
    >
      {!isPrimeUser ? (
        <Badge badgeSize="sm" badgeType="default">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.prime_status_prime,
            })}
          </Badge.Text>
        </Badge>
      ) : null}
      <Switch
        disabled={false}
        size={ESwitchSize.small}
        onChange={async (value) => {
          if (value && !isPrimeSubscriptionActive) {
            navigation?.pushModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeFeatures,
              params: {
                showAllFeatures: false,
                selectedFeature: EPrimeFeatures.OneKeyCloud,
                selectedSubscriptionPeriod: 'P1Y',
                serverUserInfo,
              },
            });
            return;
          }
          if (value) {
            await ensurePrimeSubscriptionActive({
              featureName: EPrimeFeatures.OneKeyCloud,
            });
          }

          if (isSubmittingRef.current) {
            return;
          }
          try {
            isSubmittingRef.current = true;
            if (value) {
              if (shouldChangePasswordAutoLock) {
                await new Promise<void>((resolve, reject) => {
                  Dialog.show({
                    isAsync: true,
                    disableDrag: true,
                    dismissOnOverlayPress: true,
                    title: intl.formatMessage({
                      id: ETranslations.settings_auto_lock,
                    }),
                    contentContainerProps: {
                      px: 0,
                    },
                    onClose: () => {
                      reject(new Error('User cancelled'));
                    },
                    onCancel: () => {
                      reject(new Error('User cancelled'));
                    },
                    renderContent: (
                      <AutoLockUpdateDialogContent
                        onContinue={() => {
                          resolve();
                        }}
                        onError={(error) => {
                          reject(error);
                        }}
                      />
                    ),
                  });
                });
              }
              await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
                enabled: true,
              });
              defaultLogger.prime.usage.onekeyCloudToggle({
                status: 'on',
              });
            } else {
              await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
                enabled: false,
              });
              defaultLogger.prime.usage.onekeyCloudToggle({
                status: 'off',
              });
            }
          } finally {
            isSubmittingRef.current = false;
          }
        }}
        value={config.isCloudSyncEnabled}
      />
    </ListItem>
  );
  const keylessSwitchItem = (
    <ListItem
      title={`${intl.formatMessage({
        id: ETranslations.global_onekey_cloud,
      })} (Keyless)`}
      icon="CloudOutline"
      subtitle={`${intl.formatMessage({
        id: ETranslations.prime_last_update,
      })} : ${keylessLastUpdateTime}`}
    >
      <Switch
        disabled={false}
        size={ESwitchSize.small}
        onChange={async (value) => {
          if (isSubmittingRef.current) {
            return;
          }
          try {
            isSubmittingRef.current = true;
            await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless(
              { enabled: value },
            );
          } finally {
            isSubmittingRef.current = false;
          }
        }}
        value={!!config.isCloudSyncEnabledKeyless}
      />
    </ListItem>
  );
  return (
    <>
      {showKeylessCloudSync ? keylessSwitchItem : null}
      {showKeylessCloudSync && config?.isCloudSyncEnabledKeyless ? (
        <ListItem
          title={`${intl.formatMessage({
            id: ETranslations.wallet_backup_now,
          })} ( Keyless )`}
          icon="RefreshCwOutline"
          drillIn
          onPress={onManualSyncKeyless}
        />
      ) : null}
      {onekeyIdSwitchItem}
      {config?.isCloudSyncEnabled ? (
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.wallet_backup_now,
          })}
          icon="RefreshCwOutline"
          drillIn
          onPress={onManualSyncOneKeyId}
        />
      ) : null}
    </>
  );
}

function WhatDataIncludedListItem() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync,
      })}
      icon="QuestionmarkOutline"
      subtitle={intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync_description,
      })}
      drillIn
      onPress={() => {
        navigation.navigate(EPrimePages.PrimeCloudSyncInfo);
      }}
    />
  );
}

function AppDataSection() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeCloudSync>();
  const forceReloadServerUserInfo = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const serverUserInfo = route.params?.serverUserInfo;

  const [serverMasterPasswordStatus] = usePrimeServerMasterPasswordStatusAtom();
  const isServerMasterPasswordSet =
    serverMasterPasswordStatus.isServerMasterPasswordSet;

  const [config] = usePrimeCloudSyncPersistAtom();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isSubmittingRef = useRef(false);
  const manualSyncingRef = useRef(false);

  const reloadServerUserInfo = useCallback(async () => {
    await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
  }, []);

  useEffect(() => {
    void reloadServerUserInfo();
  }, [reloadServerUserInfo]);

  const intl = useIntl();

  const handleManualSyncOneKeyId = useCallback(async () => {
    if (!config.isCloudSyncEnabled) {
      return;
    }
    if (manualSyncingRef.current) {
      return;
    }
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

  const handleManualSyncKeyless = useCallback(async () => {
    if (!config.isCloudSyncEnabledKeyless) {
      return;
    }
    if (manualSyncingRef.current) {
      return;
    }
    manualSyncingRef.current = true;
    try {
      const { password } =
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });
      await backgroundApiProxy.servicePrimeCloudSync.syncNowKeyless({
        callerName: 'Manual Cloud Sync Keyless',
        noDebounceUpload: true,
        password,
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
      <EnableOneKeyCloudSwitchListItem
        onManualSyncOneKeyId={handleManualSyncOneKeyId}
        onManualSyncKeyless={handleManualSyncKeyless}
      />

      {config?.isCloudSyncEnabled || isServerMasterPasswordSet ? (
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
      ) : null}

      <WhatDataIncludedListItem />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WalletSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [transferEnabled, setTransferEnabled] = useState(false);
  return (
    <Section title={intl.formatMessage({ id: ETranslations.prime_wallet })}>
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.transfer_transfer,
        })}
        icon="MultipleDevicesOutline"
        subtitle={intl.formatMessage({
          id: ETranslations.prime_transfer_description,
        })}
        drillIn={transferEnabled}
        onPress={
          transferEnabled
            ? () => {
                navigation.navigate(EPrimePages.PrimeTransfer);
              }
            : undefined
        }
      >
        {transferEnabled ? null : (
          <Badge badgeSize="sm">
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.id_prime_soon,
              })}
            </Badge.Text>
          </Badge>
        )}
      </ListItem>
      <MultipleClickStack
        showDevBgColor
        onPress={() => {
          setTransferEnabled(true);
        }}
      >
        <Stack h="$20" />
      </MultipleClickStack>
    </Section>
  );
}

export default function PagePrimeCloudSync() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync.showAlertDialogIfLocalPasswordNotSet();
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
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
