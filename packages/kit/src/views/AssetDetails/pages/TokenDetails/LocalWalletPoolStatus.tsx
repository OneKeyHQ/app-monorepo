import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Icon,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isUnresolvedPrivacyChainBroadcastError } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

import {
  BirthdayDialogForm,
  type IBirthdayFormState,
  LocalWalletDebugControl,
  PrivacyEnableDisclosure,
  ScanRepairControl,
  SetupRepairControl,
} from './LocalWalletRepairControls';

import type { ILocalWalletPool } from './useLocalWalletPool';

// Status of the selected pool's balance: the opt-in card when scanning is
// off, otherwise hints, notes and the sync line. Rendered directly under the
// balance on the token page; with `settingsMode` it also carries the account
// controls (send preference, pause, reset, delete, repair).
export function LocalWalletPoolStatus({
  networkId,
  accountId,
  pool: lw,
  settingsMode = false,
}: {
  networkId: string;
  accountId: string;
  pool: ILocalWalletPool;
  settingsMode?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  // The network-wide page, not this account's: from a token page the next
  // question is usually "what is this chain doing on my device", and every
  // account's own controls are one tap further in.
  const openSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.PrivacyNetworks,
      params: {
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
      },
    });
  }, [accountId, navigation]);

  const handleGuardError = useCallback(
    (error: unknown): boolean => {
      if (!isUnresolvedPrivacyChainBroadcastError(error)) return false;
      Dialog.confirm({
        title: intl.formatMessage({ id: ETranslations.global_retry }),
        description: (
          <YStack gap="$2">
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.global_an_error_occurred_desc,
              })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.tx_confirm_eta_minutes__desc },
                { minutes: 15 },
              )}
            </SizableText>
          </YStack>
        ),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_refresh }),
        onConfirm: () => {
          appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
          lw.refresh();
        },
      });
      return true;
    },
    [intl, lw],
  );

  const handleEnable = useCallback(async () => {
    // Same warning threshold as the settings page: read the live count rather
    // than assume, so a user who already scans several accounts is told before
    // adding another.
    const usage =
      await backgroundApiProxy.servicePrivacyChain.getLocalWalletSlotUsage({
        networkId,
      });
    if (!lw.settings?.accountSetup.requiresBirthday) {
      void lw.enableAccount({});
      return;
    }
    const hintTimestamp = lw.state?.birthdayHintTimestamp;
    const formRef: { current: IBirthdayFormState } = {
      current: {
        mode: 'month',
        month:
          typeof hintTimestamp === 'number' ? new Date(hintTimestamp) : null,
        height: '',
      },
    };
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslationsMock.privacy_enable_title }),
      renderContent: (
        <YStack gap="$4">
          <PrivacyEnableDisclosure
            hasRecommendedMonth={typeof hintTimestamp === 'number'}
            isTempWallet={lw.isTempWallet}
            enabledAccountCount={usage.used}
          />
          <BirthdayDialogForm formRef={formRef} monthOnly />
        </YStack>
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
      onConfirm: async ({ preventClose }) => {
        const { month } = formRef.current;
        if (!month) {
          preventClose();
          return;
        }
        await lw.enableAccount({
          birthdayTimestamp: new Date(
            month.getFullYear(),
            month.getMonth(),
            1,
          ).getTime(),
        });
      },
    });
  }, [intl, lw, networkId]);

  const handleResume = useCallback(async () => {
    try {
      await lw.enableAccount({});
    } catch (error) {
      if (!handleGuardError(error)) throw error;
    }
  }, [handleGuardError, lw]);

  const handleDisable = useCallback(async () => {
    try {
      await lw.disableAccount();
    } catch (error) {
      if (!handleGuardError(error)) throw error;
    }
  }, [handleGuardError, lw]);

  const handleReset = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslationsMock.privacy_reset_cache_title,
      }),
      description: intl.formatMessage({
        id: ETranslationsMock.privacy_reset_cache_desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
      onConfirm: async () => {
        try {
          await lw.resetLocalData();
        } catch (error) {
          if (!handleGuardError(error)) throw error;
        }
      },
    });
  }, [handleGuardError, intl, lw]);

  const handleDelete = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslationsMock.privacy_delete_data_title,
      }),
      description: intl.formatMessage({
        id: ETranslationsMock.privacy_delete_data_desc,
      }),
      tone: 'destructive',
      onConfirmText: intl.formatMessage({ id: ETranslations.global_delete }),
      onConfirm: async () => {
        try {
          await lw.deleteLocalData();
        } catch (error) {
          if (!handleGuardError(error)) throw error;
        }
      },
    });
  }, [handleGuardError, intl, lw]);

  // One gate for the whole private UI: see `isReady` in useLocalWalletPool.
  if (!lw.hasPooledBalance || !lw.isReady) {
    return null;
  }

  const isPaused = lw.state?.paused === true;

  if (!lw.enabled) {
    if (!settingsMode && lw.pool?.kind !== 'private') {
      return null;
    }
    return (
      <YStack py="$4">
        <YStack
          testID="local-wallet-disabled-card"
          p="$4"
          borderRadius="$4"
          bg="$bgSubdued"
          gap="$4"
        >
          <XStack alignItems="flex-start" gap="$3">
            <Stack
              width="$10"
              height="$10"
              borderRadius="$full"
              bg="$bgStrong"
              alignItems="center"
              justifyContent="center"
            >
              <Icon name="ShieldOutline" size="$6" color="$iconSubdued" />
            </Stack>
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage({ id: ETranslations.trade_privacy_mode })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {isPaused
                  ? intl.formatMessage({
                      id: ETranslationsMock.privacy_local_scanning_paused_desc,
                    })
                  : intl.formatMessage({
                      id: ETranslationsMock.privacy_pool_scanning_off_desc,
                    })}
              </SizableText>
            </YStack>
          </XStack>
          {/* A resume already has its recovery position on disk, so it must not
              ask for the month again -- the answer would be ignored. */}
          {isPaused ? (
            <Button
              testID="local-wallet-resume-button"
              size="medium"
              variant="primary"
              loading={lw.busy}
              onPress={handleResume}
            >
              {intl.formatMessage({
                id: ETranslationsMock.privacy_scan_resume,
              })}
            </Button>
          ) : (
            <Button
              testID="local-wallet-enable-button"
              size="medium"
              variant="primary"
              loading={lw.busy}
              disabled={
                !accountUtils.isHdAccount({ accountId }) &&
                !accountUtils.isHwAccount({ accountId })
              }
              onPress={handleEnable}
            >
              {intl.formatMessage({ id: ETranslations.global_enable })}
            </Button>
          )}
        </YStack>
        {settingsMode ? (
          <Button
            testID="local-wallet-delete-btn"
            mt="$4"
            size="small"
            variant="tertiary"
            disabled={lw.busy}
            onPress={handleDelete}
          >
            {intl.formatMessage({ id: ETranslations.global_delete })}
          </Button>
        ) : null}
      </YStack>
    );
  }

  let balanceNote: React.ReactNode = null;
  if (!lw.addresses && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCaution">
        {intl.formatMessage({
          id: ETranslationsMock.privacy_pool_setup_incomplete,
        })}
      </SizableText>
    );
  } else if (!lw.balance && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCritical">
        {intl.formatMessage({
          id: ETranslationsMock.privacy_pool_balance_unavailable,
        })}
      </SizableText>
    );
  } else if (
    lw.balance &&
    lw.balance.total === '0' &&
    lw.syncProgress?.isBackfillComplete &&
    lw.state?.birthdaySource !== 'fresh-wallet'
  ) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslationsMock.privacy_pool_early_funds_hint,
        })}
      </SizableText>
    );
  }

  // One line only, and a problem outranks a breakdown: `balanceNote` explains
  // why the number above may be wrong, the hint only explains how it is made
  // up. `hints` is ordered most-specific-first by the vault, so [0] is the one
  // worth the line.
  const hintText = lw.poolBalance?.hints[0];
  const hintLine = hintText ? (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {hintText}
    </SizableText>
  ) : null;
  const statusLine = (lw.pool ? balanceNote : null) ?? hintLine;
  // Repair controls only. On the token page the sync line and its settings
  // shortcut live under the address (LocalWalletSyncRow), and a manual boost
  // is still one tap away there, on the sync light, and automatic when a send
  // is being composed.
  let syncActions: React.ReactNode = null;
  if (settingsMode) {
    syncActions = lw.addresses ? (
      <ScanRepairControl
        networkId={networkId}
        accountId={accountId}
        currentBirthdayHeight={lw.state?.birthdayHeight}
        onDone={lw.refresh}
      />
    ) : (
      <SetupRepairControl
        networkId={networkId}
        accountId={accountId}
        onDone={lw.refresh}
      />
    );
  }

  return (
    <YStack pt="$3" gap="$2">
      {/* One line, and its height is reserved: this appears and disappears as
          polling updates the balance, and an unreserved line makes everything
          below it jump on every poll. */}
      <Stack minHeight="$5" justifyContent="center">
        {statusLine}
      </Stack>
      {settingsMode ? (
        <XStack
          pt="$1"
          justifyContent="space-between"
          alignItems="center"
          gap="$2"
        >
          {lw.syncStatusText ? (
            <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
              {lw.syncStatusText}
            </SizableText>
          ) : (
            <Stack />
          )}
          <XStack gap="$2" alignItems="center">
            {syncActions}
          </XStack>
        </XStack>
      ) : null}
      {settingsMode ? (
        <>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              testID="local-wallet-pause-btn"
              size="small"
              variant="tertiary"
              loading={lw.busy}
              onPress={handleDisable}
            >
              {intl.formatMessage({ id: ETranslations.global_pause })}
            </Button>
          </XStack>
          <Divider my="$2" />
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_advanced_settings })}
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              testID="local-wallet-reset-btn"
              size="small"
              variant="tertiary"
              disabled={lw.busy}
              onPress={handleReset}
            >
              {intl.formatMessage({ id: ETranslations.global_reset })}
            </Button>
            <Button
              testID="local-wallet-delete-btn"
              size="small"
              variant="tertiary"
              disabled={lw.busy}
              onPress={handleDelete}
            >
              {intl.formatMessage({ id: ETranslations.global_delete })}
            </Button>
          </XStack>
          <LocalWalletDebugControl
            networkId={networkId}
            accountId={accountId}
            state={lw.state}
            addresses={lw.addresses}
            balance={lw.balance}
            syncProgress={lw.syncProgress}
          />
        </>
      ) : null}
    </YStack>
  );
}

// Scan progress for the whole chain, plus the shortcut to its settings.
// It sits under the ADDRESS, not under the balance: how far this device has
// scanned is a fact about the chain, not about the number above. What the
// balance needs explained stays with the balance (see `statusLine`).
//
// The row keeps its height whether or not there is text, so the history list
// below it does not move on every poll.
export function LocalWalletSyncRow({
  networkId,
  accountId,
  pool: lw,
}: {
  networkId: string;
  accountId: string;
  pool: ILocalWalletPool;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const openSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.PrivacyNetworks,
      params: {
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
      },
    });
  }, [accountId, navigation]);

  if (!lw.hasPooledBalance || !lw.isReady || !lw.enabled) {
    return null;
  }

  return (
    <XStack
      testID="local-wallet-sync-row"
      px="$5"
      minHeight="$9"
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
    >
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        flexShrink={1}
        numberOfLines={1}
      >
        {lw.syncStatusText}
      </SizableText>
      <Button
        testID="local-wallet-open-settings-btn"
        size="small"
        variant="tertiary"
        onPress={openSettings}
      >
        {intl.formatMessage({ id: ETranslations.global_settings })}
      </Button>
    </XStack>
  );
}
