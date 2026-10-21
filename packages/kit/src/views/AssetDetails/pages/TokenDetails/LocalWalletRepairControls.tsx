import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  ScrollView,
  SegmentControl,
  SizableText,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Recovery controls for a local-wallet account. Every action goes through
// servicePrivacyChain; the copy speaks of "the chain" rather than a coin.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'month';
  month: Date | null;
  // Overrides `mode`: start at the chain's earliest birthday.
  fromEarliest?: boolean;
};

export type IEarliestBirthday = { height: number; timestamp: number };

// Enable defaults to a month, like Ledger: the recommended one when known,
// otherwise the current month, with the disclosure saying when to change it.
export function createEnableBirthdayForm(hintTimestamp?: number): {
  current: IBirthdayFormState;
} {
  const now = new Date();
  return {
    current: {
      mode: 'month',
      month:
        typeof hintTimestamp === 'number'
          ? new Date(hintTimestamp)
          : new Date(now.getFullYear(), now.getMonth(), 1),
    },
  };
}

export function readEnableBirthday(
  form: IBirthdayFormState,
  earliest: IEarliestBirthday | undefined,
): { birthdayHeight?: number; birthdayTimestamp?: number } | undefined {
  if (form.fromEarliest && earliest) {
    return { birthdayHeight: earliest.height };
  }
  if (!form.month) return undefined;
  return {
    birthdayTimestamp: new Date(
      form.month.getFullYear(),
      form.month.getMonth(),
      1,
    ).getTime(),
  };
}

// Shared by both enable entry points. Repair dialogs must NOT show it: the
// account is already scanning by then.
export function PrivacyEnableDisclosure({
  hasRecommendedMonth,
}: {
  hasRecommendedMonth: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd">
        {intl.formatMessage({ id: ETranslations.privacy_enable__desc })}
      </SizableText>
      {hasRecommendedMonth ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.privacy_enable_month__desc,
          })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function BirthdayDialogForm({
  formRef,
  currentBirthdayHeight,
  monthOnly = false,
  earliestBirthday,
}: {
  formRef: { current: IBirthdayFormState };
  currentBirthdayHeight?: number;
  monthOnly?: boolean;
  earliestBirthday?: IEarliestBirthday;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState(formRef.current.mode);
  const [fromEarliest, setFromEarliest] = useState(
    formRef.current.fromEarliest ?? false,
  );
  const [month, setMonth] = useState(formRef.current.month);
  let editor: React.ReactNode = null;
  if (mode === 'month') {
    editor = (
      <YStack gap="$2">
        <DatePicker.Month
          testID="local-wallet-birthday-month-input"
          title={intl.formatMessage({
            id: ETranslations.privacy_sync_start_month__title,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_select_month,
          })}
          minDate={
            earliestBirthday
              ? new Date(earliestBirthday.timestamp)
              : new Date(2022, 4, 1)
          }
          maxDate={new Date()}
          value={month}
          onChange={(value) => {
            setMonth(value);
            formRef.current.month = value;
          }}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.privacy_sync_start_month__desc,
          })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$3">
      {typeof currentBirthdayHeight === 'number' ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.privacy_sync_start_block__title,
            },
            { height: currentBirthdayHeight.toLocaleString('en-US') },
          )}
        </SizableText>
      ) : null}
      {monthOnly || fromEarliest ? null : (
        <SegmentControl
          fullWidth
          value={mode}
          onChange={(v) => {
            const next = v as IBirthdayFormState['mode'];
            setMode(next);
            formRef.current.mode = next;
          }}
          options={[
            {
              label: intl.formatMessage({
                id: ETranslations.privacy_sync_start_saved__title,
              }),
              value: 'saved-birthday',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.privacy_sync_start_approx_month__title,
              }),
              value: 'month',
            },
          ]}
        />
      )}
      {fromEarliest ? null : editor}
      {earliestBirthday ? (
        <YStack gap="$1">
          <Checkbox
            testID="local-wallet-birthday-from-earliest"
            value={fromEarliest}
            onChange={(checked) => {
              const next = Boolean(checked);
              setFromEarliest(next);
              formRef.current.fromEarliest = next;
            }}
            label={intl.formatMessage({
              id: ETranslations.privacy_sync_start_from_beginning__desc,
            })}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

export function SetupRepairControl({
  networkId,
  accountId,
  onDone,
}: {
  networkId: string;
  accountId: string;
  onDone: () => void;
}) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const handlePress = useCallback(async () => {
    setBusy(true);
    try {
      await backgroundApiProxy.servicePrivacyChain.retryLocalWalletAccountSetup(
        { networkId, accountId },
      );
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.privacy_sync_setup_done__msg,
        }),
      });
      onDone();
    } catch (e) {
      // Background errors auto-toast through the standard proxy.
      console.error('[privacyChain] retryLocalWalletAccountSetup failed', e);
    } finally {
      setBusy(false);
    }
  }, [networkId, accountId, onDone, intl]);

  return (
    <Button
      testID="local-wallet-repair-setup-btn"
      size="small"
      variant="tertiary"
      loading={busy}
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslations.global_retry })}
    </Button>
  );
}

export function ScanRepairControl({
  networkId,
  accountId,
  currentBirthdayHeight,
  earliestBirthday,
  onDone,
}: {
  networkId: string;
  accountId: string;
  currentBirthdayHeight?: number;
  earliestBirthday?: IEarliestBirthday;
  onDone: () => void;
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    const formRef: { current: IBirthdayFormState } = {
      current: { mode: 'saved-birthday', month: null },
    };
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      }),
      tone: 'warning',
      description: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__desc,
      }),
      renderContent: (
        <BirthdayDialogForm
          formRef={formRef}
          currentBirthdayHeight={currentBirthdayHeight}
          earliestBirthday={earliestBirthday}
        />
      ),
      onConfirmText: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      }),
      onConfirm: async ({ preventClose }) => {
        const { month, fromEarliest } = formRef.current;
        let mode: IBirthdayFormState['mode'] | 'height' = formRef.current.mode;
        let birthdayTimestamp: number | undefined;
        let birthdayHeightValue: number | undefined;
        if (fromEarliest && earliestBirthday) {
          mode = 'height';
          birthdayHeightValue = earliestBirthday.height;
        } else if (mode === 'month') {
          if (!month) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_select_month,
              }),
            });
            preventClose();
            return;
          }
          birthdayTimestamp = new Date(
            month.getFullYear(),
            month.getMonth(),
            1,
          ).getTime();
        }
        await backgroundApiProxy.servicePrivacyChain.repairLocalChainData({
          networkId,
          accountId,
          mode,
          birthdayTimestamp,
          birthdayHeight: birthdayHeightValue,
        });
        onDone();
      },
    });
  }, [
    networkId,
    accountId,
    currentBirthdayHeight,
    earliestBirthday,
    onDone,
    intl,
  ]);

  return (
    <Button
      testID="local-wallet-repair-scan-btn"
      size="small"
      variant="tertiary"
      onPress={handlePress}
    >
      {intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      })}
    </Button>
  );
}

// Developer-only dump of everything the account page reads. Kept in account
// settings because it is the one place that still works when metadata is
// missing and the normal controls cannot explain the failure.
export function LocalWalletDebugControl({
  networkId,
  accountId,
  state,
  addresses,
  balance,
  syncProgress,
}: {
  networkId: string;
  accountId: string;
  state: ILocalWalletAccountState | undefined;
  addresses: ILocalWalletAccountAddresses | null | undefined;
  balance: ILocalWalletAccountBalance | null | undefined;
  syncProgress: ILocalWalletSyncProgress | null | undefined;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const { copyText } = useClipboard();

  const handlePress = useCallback(() => {
    const dump = {
      account: { networkId, accountId },
      state: state ?? null,
      addresses: addresses ?? null,
      syncProgress: syncProgress ?? null,
      balance: balance ?? null,
    };
    const text = JSON.stringify(dump, null, 2);
    Dialog.show({
      title: 'Local wallet account debug',
      renderContent: (
        <ScrollView maxHeight={420} showsVerticalScrollIndicator>
          <SizableText size="$bodySm" selectable>
            {text}
          </SizableText>
        </ScrollView>
      ),
      onConfirmText: 'Copy',
      onConfirm: () => copyText(text),
    });
  }, [networkId, accountId, state, addresses, balance, syncProgress, copyText]);

  if (!devSettings.enabled) {
    return null;
  }
  return (
    <Button
      testID="local-wallet-debug-btn"
      size="small"
      variant="tertiary"
      onPress={handlePress}
    >
      Debug
    </Button>
  );
}
