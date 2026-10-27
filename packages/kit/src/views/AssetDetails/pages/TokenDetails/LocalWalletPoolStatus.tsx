import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showPrivacyChainSlotsFullDialog } from '@onekeyhq/kit/src/utils/privacyChainSlotsFullDialog';
import { isLocalWalletSlotsFullError } from '@onekeyhq/kit-bg/src/vaults/localWallet/userFacingError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { LocalWalletPasswordAlert } from './LocalWalletPasswordAlert';
import {
  BirthdayDialogForm,
  LocalWalletDebugControl,
  PrivacyEnableDisclosure,
  ScanRepairControl,
  SetupRepairControl,
  createEnableBirthdayForm,
  getBirthdayInputError,
  readEnableBirthday,
} from './LocalWalletRepairControls';
import { TokenPrivacyPanel } from './TokenPrivacyPanel';

import type { ILocalWalletPool } from './useLocalWalletPool';

// Background errors auto-toast; the button only keeps the rejection handled.
function logLocalWalletActionError(action: string) {
  return (error: unknown) => {
    console.error(`[privacyChain] ${action} failed`, {
      error: error instanceof Error ? error.message : '',
    });
  };
}

function useOpenPrivacyNetworkSettings({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const navigation = useAppNavigation();
  return useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.PrivacyNetworks,
      params: {
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
        networkId,
      },
    });
  }, [accountId, navigation, networkId]);
}

export function LocalWalletPoolStatus({
  networkId,
  accountId,
  pool: lw,
  settingsMode = false,
  presentation,
}: {
  networkId: string;
  accountId: string;
  pool: ILocalWalletPool;
  settingsMode?: boolean;
  presentation?: 'tokenDetails';
}) {
  const intl = useIntl();
  const openSettings = useOpenPrivacyNetworkSettings({ accountId, networkId });
  // A full network is not toasted: the dialog explains how to make room.
  const showSlotsFullOr = useCallback(
    (action: string) => (error: unknown) => {
      if (!isLocalWalletSlotsFullError(error)) {
        logLocalWalletActionError(action)(error);
        return;
      }
      showPrivacyChainSlotsFullDialog({
        intl,
        // Already on the page that lists the accounts and their data.
        onOpenSettings: settingsMode ? undefined : openSettings,
      });
    },
    [intl, openSettings, settingsMode],
  );
  // No keyring for this wallet type (e.g. Monero hardware): withhold the toggle.
  const canEnable =
    !lw.isUnsupportedWallet &&
    (accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isHwAccount({ accountId }));

  const openEnable = useCallback(async () => {
    if (lw.state?.paused || !lw.settings?.accountSetup.requiresBirthday) {
      await lw.enableAccount({}).catch(showSlotsFullOr('enable'));
      return;
    }
    const admitted = await backgroundApiProxy.servicePrivacyChain
      .assertLocalWalletAccountAdmission({ networkId, accountId })
      .then(() => true)
      .catch((error: unknown) => {
        showSlotsFullOr('enable')(error);
        return false;
      });
    if (!admitted) return;
    const twinBirthday =
      await backgroundApiProxy.servicePrivacyChain.getLocalWalletTwinBirthday({
        networkId,
        accountId,
      });
    if (twinBirthday) {
      await lw.enableAccount(twinBirthday).catch(showSlotsFullOr('enable'));
      return;
    }
    const hintTimestamp = lw.state?.birthdayHintTimestamp;
    const earliestBirthday = lw.settings?.accountSetup.earliestBirthday;
    const formRef = createEnableBirthdayForm(hintTimestamp);
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.privacy_enable__title,
      }),
      renderContent: (
        <YStack gap="$4">
          <PrivacyEnableDisclosure
            hasRecommendedMonth={typeof hintTimestamp === 'number'}
          />
          <BirthdayDialogForm
            networkId={networkId}
            formRef={formRef}
            allowSavedBirthday={false}
            earliestBirthday={earliestBirthday}
          />
        </YStack>
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
      onConfirm: async ({ preventClose }) => {
        const birthday = readEnableBirthday(
          formRef.current,
          earliestBirthday,
          networkId,
        );
        if (!birthday) {
          Toast.error({
            title: intl.formatMessage({
              id: getBirthdayInputError(formRef.current.mode),
            }),
          });
          preventClose();
          return;
        }
        try {
          await lw.enableAccount(birthday);
        } catch (error) {
          // Other failures keep this dialog open; the limit gets its own.
          if (!isLocalWalletSlotsFullError(error)) throw error;
          showSlotsFullOr('enable')(error);
        }
      },
    });
  }, [accountId, intl, lw, networkId, showSlotsFullOr]);

  // Guards against a second tap opening a second dialog in the gap before the first one opens.
  const openingEnableRef = useRef(false);
  const handleEnable = useCallback(async () => {
    if (openingEnableRef.current) return;
    openingEnableRef.current = true;
    try {
      await openEnable();
    } finally {
      openingEnableRef.current = false;
    }
  }, [openEnable]);

  const handleDelete = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.privacy_delete_data__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.privacy_delete_data__desc,
      }),
      tone: 'destructive',
      onConfirmText: intl.formatMessage({ id: ETranslations.global_delete }),
      onConfirm: async () => {
        await lw.deleteLocalData();
      },
    });
  }, [intl, lw]);

  if (!lw.hasPooledBalance || !lw.isReady) {
    return null;
  }

  let disabledDescriptionId: ETranslations =
    ETranslations.privacy_balance_privacy_off__desc;
  if (lw.isTempWallet) {
    disabledDescriptionId = ETranslations.privacy_temp_wallet_unavailable__desc;
  } else if (lw.isUnsupportedWallet) {
    disabledDescriptionId =
      ETranslations.privacy_balance_wallet_not_supported__desc;
  } else if (lw.state?.paused) {
    disabledDescriptionId = ETranslations.syncing_paused__title;
  }

  if (!lw.enabled) {
    if (!settingsMode && lw.pool?.source !== 'localScan') {
      return null;
    }
    if (presentation === 'tokenDetails' && !settingsMode) {
      return (
        <TokenPrivacyPanel
          state={
            lw.state?.pendingOperation === 'enable' ? 'preparing' : 'disabled'
          }
          description={intl.formatMessage({ id: disabledDescriptionId })}
          busy={lw.busy}
          enableUnavailable={!canEnable}
          onEnable={canEnable ? handleEnable : undefined}
        />
      );
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
              <SizableText
                testID="local-wallet-disabled-desc"
                size="$bodySm"
                color="$textSubdued"
              >
                {intl.formatMessage({
                  id: disabledDescriptionId,
                })}
              </SizableText>
            </YStack>
          </XStack>
          {canEnable ? (
            <Button
              testID="local-wallet-enable-button"
              size="medium"
              variant="primary"
              loading={lw.busy}
              onPress={handleEnable}
            >
              {intl.formatMessage({
                id: lw.state?.paused
                  ? ETranslations.global_resume
                  : ETranslations.global_enable,
              })}
            </Button>
          ) : null}
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

  // Retry would derive the same other key again; only deleting local data
  // lets the next enable adopt it.
  const identityMismatch = lw.state?.identityMismatch === true;
  const isPreparing = lw.isPreparing;
  const canRepairSetup = !lw.hasSyncError && !lw.isSyncPaused;
  const deleteForMismatch = identityMismatch ? (
    <Button
      testID="local-wallet-identity-delete-btn"
      size="small"
      variant="tertiary"
      disabled={lw.busy}
      onPress={handleDelete}
    >
      {intl.formatMessage({ id: ETranslations.global_delete })}
    </Button>
  ) : null;

  const needsPassword = lw.poolBalance?.frozen?.some(
    ({ reason }) => reason === 'needsPassword',
  );
  let syncActions: React.ReactNode = null;
  if (settingsMode && identityMismatch) {
    syncActions = deleteForMismatch;
  } else if (settingsMode && !isPreparing) {
    if (lw.addresses) {
      syncActions = (
        <ScanRepairControl
          networkId={networkId}
          accountId={accountId}
          currentBirthdayHeight={lw.state?.birthdayHeight}
          earliestBirthday={lw.settings?.accountSetup.earliestBirthday}
          onDone={lw.refresh}
        />
      );
    } else if (canRepairSetup) {
      syncActions = (
        <SetupRepairControl
          networkId={networkId}
          accountId={accountId}
          onDone={lw.refresh}
        />
      );
    }
  }

  if (!settingsMode && !needsPassword) {
    return null;
  }

  return (
    <YStack pt="$3" gap="$2">
      {needsPassword ? (
        <LocalWalletPasswordAlert networkId={networkId} accountId={accountId} />
      ) : null}
      {settingsMode ? (
        <XStack
          pt="$1"
          justifyContent="space-between"
          alignItems="center"
          gap="$2"
        >
          <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
            {lw.syncStatusText ?? '— / —'}
          </SizableText>
          <XStack gap="$2" alignItems="center">
            {syncActions}
          </XStack>
        </XStack>
      ) : null}
      {settingsMode ? (
        <>
          <Button
            testID="local-wallet-delete-btn"
            size="small"
            variant="tertiary"
            disabled={lw.busy}
            onPress={handleDelete}
          >
            {intl.formatMessage({ id: ETranslations.global_delete })}
          </Button>
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

export function LocalWalletSyncRow({
  networkId,
  accountId,
  pool: lw,
  settingsOnly = false,
}: {
  networkId: string;
  accountId: string;
  pool: ILocalWalletPool;
  settingsOnly?: boolean;
}) {
  const intl = useIntl();
  const accountPaused = lw.state?.paused === true;
  // Paused here or from the sync light; either way this button resumes it.
  const canResume = accountPaused || lw.isNetworkPaused;
  const openSettings = useOpenPrivacyNetworkSettings({ accountId, networkId });

  if (
    !lw.hasPooledBalance ||
    !lw.isReady ||
    !lw.enabled ||
    lw.pool?.source !== 'localScan'
  ) {
    return null;
  }

  const settingsButton = (
    <IconButton
      testID="local-wallet-open-settings-btn"
      ml="$2"
      size="small"
      variant="tertiary"
      icon="SettingsOutline"
      title={intl.formatMessage({ id: ETranslations.global_settings })}
      onPress={openSettings}
    />
  );
  if (settingsOnly) {
    return (
      <XStack
        px="$5"
        minHeight="$9"
        alignItems="center"
        justifyContent="flex-end"
      >
        {settingsButton}
      </XStack>
    );
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
      <YStack flex={1} minWidth={0} gap="$0.5">
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText
            size="$bodyXs"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={1}
          >
            {intl.formatMessage({ id: ETranslations.market_last_updated })}
          </SizableText>
          <SizableText
            testID="local-wallet-last-synced-at"
            size="$bodyXs"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={0}
          >
            {typeof lw.lastSyncedAt === 'number' &&
            Number.isFinite(lw.lastSyncedAt) &&
            lw.lastSyncedAt > 0
              ? formatDate(new Date(lw.lastSyncedAt), {
                  hideTheYear: true,
                  hideSeconds: true,
                })
              : '—'}
          </SizableText>
        </XStack>
        {lw.hasSyncError && !lw.isSyncPaused ? (
          <SizableText size="$bodyXs" color="$textCaution">
            {lw.syncStatusText}
          </SizableText>
        ) : null}
      </YStack>
      <Button
        testID="local-wallet-refresh-balance-btn"
        mr="$0"
        size="small"
        variant="tertiary"
        icon={canResume ? 'PlayOutline' : 'RefreshCcwOutline'}
        loading={lw.busy}
        onPress={() => {
          let action = lw.refreshBalanceNow;
          if (accountPaused) {
            action = () => lw.enableAccount({});
          } else if (lw.isNetworkPaused) {
            action = lw.resumeNetworkSync;
          }
          void action().catch(logLocalWalletActionError('refresh'));
        }}
      >
        {intl.formatMessage({
          id: canResume
            ? ETranslations.global_resume
            : ETranslations.privacy_balance_refresh__action,
        })}
      </Button>
      {settingsButton}
    </XStack>
  );
}
