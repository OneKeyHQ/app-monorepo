import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { LocalWalletFrozenLines } from './LocalWalletFrozenLines';
import { LocalWalletPasswordAlert } from './LocalWalletPasswordAlert';
import {
  BirthdayDialogForm,
  LocalWalletDebugControl,
  PrivacyEnableDisclosure,
  ScanRepairControl,
  SetupRepairControl,
  createEnableBirthdayForm,
  readEnableBirthday,
} from './LocalWalletRepairControls';

import type { ILocalWalletPool } from './useLocalWalletPool';

// Opt-in card when scanning is off, otherwise hints/notes/sync line; with `settingsMode` also carries the account controls.
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
  // A wallet type with no keyring for this chain can never scan (e.g. Monero has no hardware keyring); the toggle is withheld rather than offered and refused.
  const canEnable =
    !lw.isUnsupportedWallet &&
    (accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isHwAccount({ accountId }));

  const openEnable = useCallback(async () => {
    if (!lw.settings?.accountSetup.requiresBirthday) {
      void lw.enableAccount({});
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
            isTempWallet={lw.isTempWallet}
          />
          <BirthdayDialogForm
            formRef={formRef}
            monthOnly
            earliestBirthday={earliestBirthday}
          />
        </YStack>
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
      onConfirm: async ({ preventClose }) => {
        const birthday = readEnableBirthday(formRef.current, earliestBirthday);
        if (!birthday) {
          preventClose();
          return;
        }
        await lw.enableAccount(birthday);
      },
    });
  }, [intl, lw]);

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

  const handleResume = useCallback(async () => {
    await lw.enableAccount({});
  }, [lw]);

  const handleDisable = useCallback(async () => {
    await lw.disableAccount();
  }, [lw]);

  const handleReset = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      }),
      description: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
      onConfirm: async () => {
        await lw.resetLocalData();
      },
    });
  }, [intl, lw]);

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

  // One gate for the whole private UI: see `isReady` in useLocalWalletPool.
  if (!lw.hasPooledBalance || !lw.isReady) {
    return null;
  }

  const isPaused = lw.state?.paused === true;

  let disabledDescriptionId: ETranslations =
    ETranslations.privacy_balance_privacy_off__desc;
  if (lw.isUnsupportedWallet) {
    disabledDescriptionId =
      ETranslations.privacy_balance_wallet_not_supported__desc;
  } else if (isPaused) {
    disabledDescriptionId = ETranslations.syncing_paused__title;
  }

  if (!lw.enabled) {
    if (!settingsMode && lw.pool?.source !== 'localScan') {
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
              <SizableText
                testID="local-wallet-disabled-desc"
                size="$bodySm"
                color="$textSubdued"
              >
                {intl.formatMessage({ id: disabledDescriptionId })}
              </SizableText>
            </YStack>
          </XStack>
          {/* Resume already has its recovery position on disk; asking for the month again would be ignored. */}
          {isPaused && !lw.isUnsupportedWallet ? (
            <Button
              testID="local-wallet-resume-button"
              size="medium"
              variant="primary"
              loading={lw.busy}
              onPress={handleResume}
            >
              {intl.formatMessage({
                id: ETranslations.global_resume,
              })}
            </Button>
          ) : null}
          {!isPaused && canEnable ? (
            <Button
              testID="local-wallet-enable-button"
              size="medium"
              variant="primary"
              loading={lw.busy}
              onPress={handleEnable}
            >
              {intl.formatMessage({ id: ETranslations.global_enable })}
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

  let balanceNote: React.ReactNode = null;
  if (!lw.addresses && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCaution">
        {intl.formatMessage({
          id: ETranslations.privacy_error_setup_incomplete__msg,
        })}
      </SizableText>
    );
  } else if (!lw.balance && lw.hasAttemptedBalance) {
    balanceNote = (
      <SizableText size="$bodySm" color="$textCritical">
        {intl.formatMessage({
          id: ETranslations.privacy_balance_unavailable__msg,
        })}
      </SizableText>
    );
  }

  // A problem outranks a breakdown: balanceNote explains why the number may be wrong; hints are ordered most-specific-first, so [0] is the one worth showing.
  const hintText = lw.poolBalance?.hints[0];
  const hintLine = hintText ? (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {hintText}
    </SizableText>
  ) : null;
  // Why funds can't be spent outranks a pool note; password-only causes get the full alert since only the user can act.
  const needsPassword = lw.poolBalance?.frozen?.some(
    ({ reason }) => reason === 'needsPassword',
  );
  let frozenLine: React.ReactNode = null;
  if (needsPassword) {
    frozenLine = (
      <LocalWalletPasswordAlert networkId={networkId} accountId={accountId} />
    );
  } else if (lw.poolBalance?.frozen?.length) {
    frozenLine = (
      <LocalWalletFrozenLines
        networkId={networkId}
        accountId={accountId}
        frozen={lw.poolBalance.frozen}
        maxLines={1}
        onVerified={lw.refresh}
      />
    );
  }
  const statusLine = (lw.pool ? balanceNote : null) ?? frozenLine ?? hintLine;
  // Repair controls only; the sync line and its settings shortcut live under the address (LocalWalletSyncRow).
  let syncActions: React.ReactNode = null;
  if (settingsMode) {
    syncActions = lw.addresses ? (
      <ScanRepairControl
        networkId={networkId}
        accountId={accountId}
        currentBirthdayHeight={lw.state?.birthdayHeight}
        earliestBirthday={lw.settings?.accountSetup.earliestBirthday}
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

  // The note says "Tap Retry"; nothing else on the token page offers it, under the same condition statusLine uses.
  const setupIncomplete = !!lw.pool && !lw.addresses && lw.hasAttemptedBalance;
  const inlineSetupRetry =
    !settingsMode && setupIncomplete ? (
      <SetupRepairControl
        networkId={networkId}
        accountId={accountId}
        onDone={lw.refresh}
      />
    ) : null;

  return (
    <YStack pt="$3" gap="$2">
      {/* Height is reserved: this line appears/disappears as polling updates the balance, and unreserved would make everything below jump. */}
      <XStack minHeight="$5" alignItems="center" gap="$2">
        <Stack flexShrink={1}>{statusLine}</Stack>
        {inlineSetupRetry}
      </XStack>
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

// Scan progress for the chain; sits under the ADDRESS (not the balance) and keeps its height whether or not there's text, so the history list below doesn't jump on every poll.
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
        networkId,
      },
    });
  }, [accountId, navigation, networkId]);

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
        {/* Unknown until the first figures arrive, never an empty row. */}
        {lw.syncStatusText ?? '— / —'}
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
