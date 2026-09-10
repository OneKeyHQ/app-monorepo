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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

  const openSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.PrivacyNetworkAccount,
      params: {
        accountId,
        accountName: lw.accountName || '',
        networkId,
      },
    });
  }, [accountId, lw.accountName, navigation, networkId]);

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

  const handleEnable = useCallback(() => {
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
      title: intl.formatMessage({ id: ETranslations.trade_privacy_mode }),
      description: intl.formatMessage({
        id: ETranslations.trade_privacy_mode_tooltips,
      }),
      renderContent: <BirthdayDialogForm formRef={formRef} monthOnly />,
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
  }, [intl, lw]);

  const handleDisable = useCallback(async () => {
    try {
      await lw.disableAccount();
    } catch (error) {
      if (!handleGuardError(error)) throw error;
    }
  }, [handleGuardError, lw]);

  const handleReset = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.settings_data }),
      description: intl.formatMessage({
        id: ETranslations.settings_clear_data_confirm,
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
      title: intl.formatMessage({ id: ETranslations.settings_data }),
      description: intl.formatMessage({
        id: ETranslations.settings_clear_data_confirm,
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

  if (!lw.hasPooledBalance || !lw.isStateSettled) {
    return null;
  }

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
                Local scanning is off. Enable it to view this pool&apos;s
                balance, receive address, and history.
              </SizableText>
            </YStack>
          </XStack>
          <Button
            testID="local-wallet-enable-button"
            size="medium"
            variant="primary"
            loading={lw.busy}
            disabled={!accountUtils.isHdAccount({ accountId })}
            onPress={handleEnable}
          >
            {intl.formatMessage({ id: ETranslations.global_enable })}
          </Button>
        </YStack>
      </YStack>
    );
  }

  let balanceNote: React.ReactNode = null;
  if (!lw.addresses && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCaution">
        Setup was not completed — tap Repair to complete it.
      </SizableText>
    );
  } else if (!lw.balance && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCritical">
        Balance unavailable — retrying in background
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
        Received funds before importing? Move the scan start back with Repair.
      </SizableText>
    );
  }

  const hintText = lw.poolBalance?.hints.join(' · ');
  let syncActions: React.ReactNode;
  if (lw.addresses) {
    syncActions = (
      <>
        <Button
          testID="local-wallet-sync-now-btn"
          size="small"
          variant="tertiary"
          onPress={lw.startSync}
        >
          Sync
        </Button>
        {settingsMode ? (
          <ScanRepairControl
            networkId={networkId}
            accountId={accountId}
            currentBirthdayHeight={lw.state?.birthdayHeight}
            onDone={lw.refresh}
          />
        ) : (
          <Button
            testID="local-wallet-open-settings-btn"
            size="small"
            variant="tertiary"
            onPress={openSettings}
          >
            {intl.formatMessage({ id: ETranslations.global_settings })}
          </Button>
        )}
      </>
    );
  } else if (settingsMode) {
    syncActions = (
      <SetupRepairControl
        networkId={networkId}
        accountId={accountId}
        onDone={lw.refresh}
      />
    );
  } else {
    syncActions = (
      <Button
        testID="local-wallet-open-settings-btn"
        size="small"
        variant="tertiary"
        onPress={openSettings}
      >
        {intl.formatMessage({ id: ETranslations.global_settings })}
      </Button>
    );
  }

  return (
    <YStack pt="$3" gap="$2">
      {hintText ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {hintText}
        </SizableText>
      ) : null}
      {lw.pool ? balanceNote : null}
      {settingsMode ? (
        <XStack
          py="$1"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium">
              Use {lw.settings?.addressForms.publicLabel.toLowerCase()} funds
              first
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              For sends to private addresses, spend public funds before the
              selected private pool. This links the public address to that
              transaction.
            </SizableText>
          </YStack>
          <Switch
            testID="local-wallet-prefer-public-switch"
            size={ESwitchSize.small}
            value={lw.state?.preferPublicSends === true}
            disabled={lw.busy}
            onChange={(next) => {
              void lw.setPreferPublicSends(next);
            }}
          />
        </XStack>
      ) : null}
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
