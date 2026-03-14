import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  HeaderIconButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Switch,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
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

function CloudSyncHeader({ onLearnMore }: { onLearnMore: () => void }) {
  return (
    <>
      <Stack px="$5" pt="$4" pb="$3">
        <SizableText size="$headingMd">
          Sync your data across devices
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {'Wallet names, bookmarks, and settings — end-to-end encrypted. '}
          <SizableText
            size="$bodyMd"
            color="$textInteractive"
            textDecorationLine="underline"
            onPress={onLearnMore}
          >
            Learn more
          </SizableText>
        </SizableText>
      </Stack>
      <Divider />
    </>
  );
}

function AppDataSection() {
  const forceReloadServerUserInfo = useRef(false);

  const [config] = usePrimeCloudSyncPersistAtom();
  const isSubmittingRef = useRef(false);
  const manualSyncingRef = useRef(false);

  const intl = useIntl();
  const navigation = useAppNavigation();
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  // Fetch keyless wallet existence + info in one call to avoid loading flash
  const { result: keylessWalletResult, isLoading: kwLoading } =
    usePromiseResult(async () => {
      if (!isKeylessWalletEnabled) {
        return { exists: false, info: null };
      }
      const wallet = await backgroundApiProxy.serviceAccount.getKeylessWallet();
      if (!wallet) return { exists: false, info: null };
      return {
        exists: true,
        info: {
          name: wallet.name,
          emoji: wallet.avatarInfo?.emoji ?? '',
          label: `${wallet.avatarInfo?.emoji ?? ''} ${wallet.name}`.trim(),
        },
      };
    }, [isKeylessWalletEnabled]);

  const kwExists = keylessWalletResult?.exists ?? false;
  const keylessWalletInfo = keylessWalletResult?.info ?? null;

  // Scenario derivation (4 states, priority: 4 > 3 > 2 > 1)
  // Scenarios 1/2 depend on kwExists, so skip them while loading to avoid flash
  const isActiveIdUser = !!config.isCloudSyncEnabled; // Scenario 4
  const isActiveKwUser = !!config.isCloudSyncEnabledKeyless && !isActiveIdUser; // Scenario 3
  const isSyncOffWithKw =
    !kwLoading && !isActiveIdUser && !isActiveKwUser && kwExists; // Scenario 2
  const isSyncOffNoKw =
    !kwLoading && !isActiveIdUser && !isActiveKwUser && !kwExists; // Scenario 1

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

  // Navigate to KW creation flow (Scenario 1)
  const handleCreateKeylessWallet = useCallback(() => {
    navigation.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.OneKeyIDLogin,
        params: {
          mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        },
      },
    });
  }, [navigation]);

  // Migrate ID → Keyless (Scenario 4 "Switch Now")
  const handleMigrateToKeyless = useCallback(async () => {
    if (!kwExists) {
      Dialog.show({
        title: 'Cloud syncing require a keyless wallet.',
        onConfirmText: 'Create keyless wallet',
        onConfirm: () => handleCreateKeylessWallet(),
      });
      return;
    }
    // Has KW → proceed directly (no extra confirm — "Switch Now" is already explicit intent)
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    await backgroundApiProxy.serviceApp.showDialogLoading({
      title: intl.formatMessage({
        id: ETranslations.global_syncing,
      }),
    });
    try {
      // Sync ID data first to ensure latest data is downloaded
      await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow({
        callerName: 'Migration: ID sync before switch',
        noDebounceUpload: true,
      });
      // Then disable ID and enable KW (re-encrypts data)
      await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
        enabled: false,
      });
      await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless({
        enabled: true,
      });
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
  }, [kwExists, intl, handleCreateKeylessWallet]);

  // Toggle ID sync (Scenario 4)
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

  // Toggle Keyless sync (Scenario 2 → 3 or 3 → 2)
  const handleToggleKeylessSync = useCallback(
    async (value: boolean) => {
      if (isSubmittingRef.current) return;
      try {
        isSubmittingRef.current = true;
        await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSyncKeyless({
          enabled: value,
        });
        if (value && keylessWalletInfo) {
          void backgroundApiProxy.serviceApp.showToast({
            method: 'success',
            title: `Syncing data with ${keylessWalletInfo.label}. To sync on another device, log in with the same wallet.`,
          });
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [keylessWalletInfo],
  );

  // Manual sync ID (Scenario 4)
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
      {/* Persistent header — always shown */}
      <CloudSyncHeader
        onLearnMore={() => navigation.navigate(EPrimePages.PrimeCloudSyncInfo)}
      />

      {/* Scenario 1: No KW, sync off */}
      {isSyncOffNoKw ? (
        <Stack px="$5" pt="$4" gap="$3">
          <SizableText size="$bodyMd" color="$textSubdued">
            Cloud syncing require a keyless wallet.
          </SizableText>
          <Button onPress={handleCreateKeylessWallet}>
            Create keyless wallet
          </Button>
        </Stack>
      ) : null}

      {/* Scenario 2: Has KW, sync off */}
      {isSyncOffWithKw ? (
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
            value={false}
          />
        </ListItem>
      ) : null}

      {/* Scenario 3: KW sync active */}
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
            {keylessWalletInfo ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {keylessWalletInfo.label}
              </SizableText>
            ) : null}
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleKeylessSync}
              value={!!config.isCloudSyncEnabledKeyless}
            />
          </ListItem>
          <ListItem
            title="Sync now"
            icon="RefreshCwOutline"
            drillIn
            onPress={handleManualSyncKeyless}
          />
        </>
      ) : null}

      {/* Scenario 4: Active ID user */}
      {isActiveIdUser ? (
        <>
          <Alert
            type="warning"
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
            <SizableText size="$bodyMd" color="$textSubdued">
              OneKey ID
            </SizableText>
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleIdSync}
              value={config.isCloudSyncEnabled}
            />
          </ListItem>
          <ListItem
            title="Sync now"
            icon="RefreshCwOutline"
            drillIn
            onPress={handleManualSyncOneKeyId}
          />
          <ListItem
            title="Change OneKey ID password"
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
