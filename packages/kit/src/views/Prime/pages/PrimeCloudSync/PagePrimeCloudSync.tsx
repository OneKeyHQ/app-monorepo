import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Switch,
  resetToRoute,
  startViewTransition,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
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

const listItemNativePressableStyle = { flexShrink: 0 } as const;

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

function CloudSyncIllustration() {
  return (
    <Stack w={160} h={80} justifyContent="flex-end">
      {/* Central cloud icon */}
      <Icon
        name="CloudSyncSolid"
        size="$12"
        color="$brand10"
        alignSelf="center"
      />

      {/* Wallet icon — top left */}
      <Stack position="absolute" bottom={16} left="10%" rotate="-12deg">
        <Icon name="WalletSolid" size="$5" color="$brand7" />
      </Stack>

      {/* Contact/AddressBook icon — top right */}
      <Stack position="absolute" top={8} right="40%" rotate="10deg">
        <Icon name="PeopleSolid" size="$4" color="$brand6" />
      </Stack>

      {/* Crypto/Coin icon — bottom right */}
      <Stack position="absolute" bottom={16} right="10%" rotate="8deg">
        <Icon name="EthereumSolid" size="$5" color="$brand7" />
      </Stack>

      {/* Decorative dots */}
      <Stack
        position="absolute"
        top={2}
        left={56}
        w="$2"
        h="$2"
        borderRadius="$full"
        bg="$brand4"
      />
      <Stack
        position="absolute"
        top={24}
        right={40}
        w="$1.5"
        h="$1.5"
        borderRadius="$full"
        bg="$brand3"
      />
      <Stack
        position="absolute"
        bottom={40}
        left={48}
        w="$2.5"
        h="$2.5"
        borderRadius="$full"
        bg="$brand4"
      />
      <Stack
        position="absolute"
        top={16}
        left={32}
        w="$1.5"
        h="$1.5"
        borderRadius="$full"
        bg="$brand3"
      />
      <Stack
        position="absolute"
        top={40}
        right={56}
        w="$1"
        h="$1"
        borderRadius="$full"
        bg="$brand5"
      />
    </Stack>
  );
}

function CloudSyncHeader({ onLearnMore }: { onLearnMore: () => void }) {
  const intl = useIntl();
  return (
    <>
      <Stack px="$5" pb="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {`${intl.formatMessage({ id: ETranslations.prime_onekey_cloud_desc })} `}
          <SizableText
            size="$bodyMd"
            color="$textInteractive"
            userSelect="none"
            hoverStyle={{ color: '$textInteractiveHover' }}
            onPress={onLearnMore}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
        </SizableText>
      </Stack>
      <Divider mx="$5" my="$2" />
    </>
  );
}

function AppDataSection() {
  const [config] = usePrimeCloudSyncPersistAtom();
  const isSubmittingRef = useRef(false);
  const manualSyncingRef = useRef(false);

  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const { loginOneKeyId } = useOneKeyAuth();

  // Fetch keyless wallet existence + info in one call to avoid loading flash
  const { result: keylessWalletResult, isLoading: kwLoading } =
    usePromiseResult(async () => {
      if (!isKeylessWalletEnabled) {
        return { exists: false, wallet: undefined };
      }
      const wallet = await backgroundApiProxy.serviceAccount.getKeylessWallet();
      if (!wallet) return { exists: false, wallet: undefined };
      return { exists: true, wallet };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      isKeylessWalletEnabled,
      config.isCloudSyncEnabledKeyless,
      config.currentCloudSyncKeylessWalletId,
    ]);

  const kwExists = keylessWalletResult?.exists ?? false;
  const keylessWallet = keylessWalletResult?.wallet;

  // Scenario derivation (7 states, priority: 4 > 5 > 3 > 7 > 2 > 6 > 1)
  // Scenarios 1/2/5/6 depend on kwExists, so skip them while loading to avoid flash
  const hasConflictingCloudSyncModes =
    !!config.isCloudSyncEnabled && !!config.isCloudSyncEnabledKeyless;
  const isActiveIdUser =
    !!config.isCloudSyncEnabled && !hasConflictingCloudSyncModes; // Scenario 4
  const isKwSyncEnabled = !!config.isCloudSyncEnabledKeyless;
  const isKwRemovedWhileSyncOn = !kwLoading && isKwSyncEnabled && !kwExists; // Scenario 5
  const isActiveKwUser =
    !kwLoading && isKwSyncEnabled && !isKwRemovedWhileSyncOn; // Scenario 3
  const hasUsedKeylessSyncBefore =
    !!config.hasEverEnabledKeylessSync ||
    !!config.lastSyncTimeKeyless ||
    !!config.isCloudSyncEnabledKeyless;
  const hasUsedOneKeyIdSyncBefore =
    !!config.hasEverEnabledOneKeyIdSync ||
    !!config.lastSyncTimeOneKeyId ||
    (!!config.lastSyncTime && !config.lastSyncTimeKeyless);
  // Scenario 7: Former ID-only user (sync off). Applies regardless of KW
  // existence — if the last sync mode was OneKey ID, keep showing the ID
  // switch until the user explicitly migrates to Keyless.
  const isFormerIdUser =
    !kwLoading &&
    !isActiveIdUser &&
    !isKwSyncEnabled &&
    !hasUsedKeylessSyncBefore &&
    hasUsedOneKeyIdSyncBefore;
  const isSyncOffWithKw =
    !kwLoading &&
    !isActiveIdUser &&
    !isKwSyncEnabled &&
    kwExists &&
    !isFormerIdUser; // Scenario 2
  const isFormerKwUserNoKw =
    !kwLoading &&
    !isActiveIdUser &&
    !isKwSyncEnabled &&
    !kwExists &&
    hasUsedKeylessSyncBefore; // Scenario 6
  const isSyncOffNoKw =
    !kwLoading &&
    !isActiveIdUser &&
    !isKwSyncEnabled &&
    !kwExists &&
    !hasUsedKeylessSyncBefore &&
    !hasUsedOneKeyIdSyncBefore; // Scenario 1

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

  const ensureOneKeyIdSyncActionAllowed = useCallback(async () => {
    const isPrimeLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
    if (!isPrimeLoggedIn) {
      try {
        await loginOneKeyId();
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
      }
      return false;
    }

    const isPrimeSubscriptionActive =
      await backgroundApiProxy.servicePrime.isPrimeSubscriptionActive();
    if (!isPrimeSubscriptionActive) {
      navigation.push(EPrimePages.PrimeDashboard, {
        fromFeature: EPrimeFeatures.OneKeyCloud,
      });
      return false;
    }

    return true;
  }, [loginOneKeyId, navigation]);

  useEffect(() => {
    if (!hasConflictingCloudSyncModes) {
      return;
    }
    void backgroundApiProxy.servicePrimeCloudSync.normalizeCloudSyncStateForPageEnter();
  }, [hasConflictingCloudSyncModes]);

  useEffect(() => {
    if (isActiveIdUser) {
      void reloadServerUserInfo();
    }
  }, [isActiveIdUser, reloadServerUserInfo]);

  useEffect(() => {
    if (!config.isCloudSyncEnabled || config.hasEverEnabledOneKeyIdSync) {
      return;
    }
    void backgroundApiProxy.servicePrimeCloudSync.backfillOneKeyIdSyncHistoryIfNeeded();
  }, [config.hasEverEnabledOneKeyIdSync, config.isCloudSyncEnabled]);

  // --- Handlers ---

  // Navigate to KW creation flow (Scenario 1)
  const handleCreateKeylessWallet = useCallback(() => {
    const onboardingParams = {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.OneKeyIDLogin,
        params: {
          mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        },
      },
    } as const;

    if (platformEnv.isNative) {
      // Previous logic:
      // await popModalPages();
      // appGlobals.$rootAppNavigation?.push(
      //   ERootRoutes.Onboarding,
      //   onboardingParams,
      // );
      //
      resetToRoute(ERootRoutes.Onboarding, onboardingParams);
      return;
    }

    navigation.navigate(ERootRoutes.Onboarding, onboardingParams);
  }, [navigation]);

  // Migrate ID → Keyless (Scenario 4 "Switch Now")
  const handleMigrateToKeyless = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!kwExists) {
      Dialog.show({
        icon: 'CloudOutline',
        tone: 'success',
        title: intl.formatMessage({
          id: ETranslations.create_keyless_wallet_and_switch_syncing__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.create_keyless_wallet_first__desc,
        }),
        showCancelButton: false,
        onConfirmText: intl.formatMessage({
          id: ETranslations.create_and_switch__action,
        }),
        onConfirm: async () => {
          await backgroundApiProxy.serviceKeylessCloudSync.setPendingAutoEnableCloudSyncKeyless(
            true,
          );
          handleCreateKeylessWallet();
        },
      });
      return;
    }
    // Has KW → proceed directly (no extra confirm — "Switch Now" is already explicit intent)
    isSubmittingRef.current = true;
    try {
      await backgroundApiProxy.serviceKeylessCloudSync.setPendingAutoEnableCloudSyncKeyless(
        false,
      );
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.serviceKeylessCloudSync.enableKeylessCloudSyncWithMigrationIfNeeded(
        {
          showLoading: true,
        },
      );
    } finally {
      isSubmittingRef.current = false;
    }
  }, [kwExists, intl, handleCreateKeylessWallet]);

  // Toggle ID sync (Scenario 4)
  const handleToggleIdSync = useCallback(
    async (value: boolean) => {
      if (isSubmittingRef.current) return;
      try {
        isSubmittingRef.current = true;
        if (value) {
          const isAllowed = await ensureOneKeyIdSyncActionAllowed();
          if (!isAllowed) {
            return;
          }
        }
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
    [ensureOneKeyIdSyncActionAllowed, intl, shouldChangePasswordAutoLock],
  );

  // Toggle Keyless sync (Scenario 2 → 3 or 3 → 2)
  const handleToggleKeylessSync = useCallback(async (value: boolean) => {
    if (isSubmittingRef.current) return;
    try {
      isSubmittingRef.current = true;
      await backgroundApiProxy.serviceKeylessCloudSync.toggleCloudSyncKeyless({
        enabled: value,
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, []);

  // Manual sync ID (Scenario 4)
  const handleManualSyncOneKeyId = useCallback(async () => {
    if (!config.isCloudSyncEnabled) return;
    if (manualSyncingRef.current) return;
    const isAllowed = await ensureOneKeyIdSyncActionAllowed();
    if (!isAllowed) {
      return;
    }
    manualSyncingRef.current = true;
    try {
      await backgroundApiProxy.servicePrimeCloudSync.ensureOneKeyIdCloudSyncAvailableForManualSync();
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });
      try {
        await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow({
          callerName: 'Manual Cloud Sync OneKey ID',
          noDebounceUpload: true,
          forceSync: true,
        });
        await backgroundApiProxy.servicePrimeCloudSync.updateLastSyncTime({
          syncMode: ECloudSyncMode.OnekeyId,
        });
      } finally {
        await timerUtils.wait(1000);
        await backgroundApiProxy.serviceApp.hideDialogLoading();
      }
      void backgroundApiProxy.serviceApp.showToast({
        method: 'success',
        title: intl.formatMessage({
          id: ETranslations.global_sync_successfully,
        }),
      });
    } finally {
      manualSyncingRef.current = false;
    }
  }, [config.isCloudSyncEnabled, ensureOneKeyIdSyncActionAllowed, intl]);

  // "Sync now" when KW removed (Scenario 5) — show toast instead of syncing
  const handleSyncNowKwRemoved = useCallback(() => {
    void backgroundApiProxy.serviceApp.showToast({
      method: 'error',
      title: intl.formatMessage({
        id: ETranslations.keyless_wallet_removed__desc,
      }),
    });
  }, [intl]);

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
      await backgroundApiProxy.servicePrimeCloudSync.syncNowKeyless({
        callerName: 'Manual Cloud Sync Keyless',
        noDebounceUpload: true,
        forceSync: true,
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

  const handleOpenCloudSyncDebugPage = useCallback(() => {
    navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
  }, [navigation]);

  return (
    <>
      {/* Persistent header — always shown */}
      <CloudSyncHeader
        onLearnMore={() => navigation.navigate(EPrimePages.PrimeCloudSyncInfo)}
      />

      {/* Scenario 6: Former Keyless sync user, no KW, sync off */}
      {isFormerKwUserNoKw ? (
        <>
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.syncing_paused__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.keyless_wallet_removed__desc,
            })}
            actionLayout={media.sm ? 'vertical' : undefined}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.restore_keyless_wallet__action,
              }),
              onPrimaryPress: handleCreateKeylessWallet,
            }}
            mx="$5"
            mt="$2"
            mb="$3"
          />
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
        </>
      ) : null}

      {/* Scenario 7: Former ID-only sync user, sync off (KW may or may not exist) */}
      {isFormerIdUser ? (
        <>
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.switch_to_keyless_wallet_sync__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.switch_to_keyless_wallet_sync__desc,
            })}
            actionLayout={media.sm ? 'vertical' : undefined}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.switch_now__action,
              }),
              onPrimaryPress: handleMigrateToKeyless,
            }}
            mx="$5"
            mt="$2"
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
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleIdSync}
              value={config.isCloudSyncEnabled}
            />
          </ListItem>
        </>
      ) : null}

      {/* Scenario 1: No KW, sync off, no ID sync history */}
      {isSyncOffNoKw ? (
        <Stack px="$5" pb="$16" flex={1} alignItems="center">
          <Stack gap="$4" flex={1} alignItems="center" justifyContent="center">
            <CloudSyncIllustration />
            <Stack gap="$2">
              <SizableText size="$headingLg">
                {intl.formatMessage({
                  id: ETranslations.create_keyless_wallet_first__title,
                })}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.create_keyless_wallet_first__desc,
                })}
              </SizableText>
            </Stack>
            <Button
              size="large"
              variant="primary"
              onPress={handleCreateKeylessWallet}
            >
              {intl.formatMessage({
                id: ETranslations.create_and_enable_syncing,
              })}
            </Button>
          </Stack>
          <MultipleClickStack
            w="100%"
            h="$10"
            onPress={handleOpenCloudSyncDebugPage}
          />
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
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleKeylessSync}
              value={!!config.isCloudSyncEnabledKeyless}
            />
          </ListItem>
          {keylessWallet ? (
            <ListItem
              icon="Wallet4Outline"
              title={intl.formatMessage({
                id: ETranslations.keyless_wallet,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.syncing_with_wallet__msg,
              })}
            >
              <Stack flexDirection="row" alignItems="center" gap="$1.5">
                <WalletAvatar wallet={keylessWallet} size="$5" />
                <SizableText size="$bodyLg" color="$textSubdued">
                  {keylessWallet.name}
                </SizableText>
              </Stack>
            </ListItem>
          ) : null}
          <Divider mx="$5" my="$2" />
          <ListItem
            title={intl.formatMessage({ id: ETranslations.wallet_backup_now })}
            icon="RefreshCwOutline"
            drillIn
            nativePressableStyle={listItemNativePressableStyle}
            onPress={handleManualSyncKeyless}
          />
        </>
      ) : null}

      {/* Scenario 5: KW sync ON but wallet removed */}
      {isKwRemovedWhileSyncOn ? (
        <>
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.syncing_paused__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.keyless_wallet_removed__desc,
            })}
            actionLayout={media.sm ? 'vertical' : undefined}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.restore_keyless_wallet__action,
              }),
              onPrimaryPress: handleCreateKeylessWallet,
            }}
            mx="$5"
            mt="$2"
            mb="$3"
          />
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
          <Divider mx="$5" my="$2" />
          <ListItem
            title={intl.formatMessage({ id: ETranslations.wallet_backup_now })}
            icon="RefreshCwOutline"
            drillIn
            nativePressableStyle={listItemNativePressableStyle}
            onPress={handleSyncNowKwRemoved}
          />
        </>
      ) : null}

      {/* Scenario 4: Active ID user */}
      {isActiveIdUser ? (
        <>
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.switch_to_keyless_wallet_sync__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.switch_to_keyless_wallet_sync__desc,
            })}
            actionLayout={media.sm ? 'vertical' : undefined}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.switch_now__action,
              }),
              onPrimaryPress: handleMigrateToKeyless,
            }}
            mx="$5"
            mt="$2"
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
            <Switch
              size={ESwitchSize.small}
              onChange={handleToggleIdSync}
              value={config.isCloudSyncEnabled}
            />
          </ListItem>
          <Divider mx="$5" my="$2" />
          <ListItem
            title={intl.formatMessage({ id: ETranslations.wallet_backup_now })}
            icon="RefreshCwOutline"
            drillIn
            nativePressableStyle={listItemNativePressableStyle}
            onPress={handleManualSyncOneKeyId}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.prime_change_backup_password,
            })}
            icon="Key2Outline"
            drillIn
            nativePressableStyle={listItemNativePressableStyle}
            onPress={async () => {
              try {
                await backgroundApiProxy.serviceMasterPassword.startChangePassword();
              } finally {
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

  const renderDebugHeaderRight = useCallback(
    () => (
      <Button
        variant="tertiary"
        onPress={() => {
          navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
        }}
      >
        Debug
      </Button>
    ),
    [navigation],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
        headerRight={platformEnv.isDev ? renderDebugHeaderRight : undefined}
      />
      <Page.Body>
        <AppDataSection />
        <MultipleClickStack
          h="$10"
          showDevBgColor
          onPress={() => {
            navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
          }}
        />
      </Page.Body>
    </Page>
  );
}
