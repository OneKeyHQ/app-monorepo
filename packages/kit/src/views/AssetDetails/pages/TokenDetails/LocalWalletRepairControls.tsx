import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  Input,
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
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

// Recovery controls for a local-wallet account. Every action goes through
// servicePrivacyChain; the copy speaks of "the chain" rather than a coin.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'date' | 'height';
  date: Date | null;
  height?: string;
  // Overrides `mode`: start at the chain's earliest birthday.
  fromEarliest?: boolean;
};

export type IEarliestBirthday = { height: number; timestamp: number };

// Preserve the previous fallback scan date while offering day precision.
export function createEnableBirthdayForm(hintTimestamp?: number): {
  current: IBirthdayFormState;
} {
  const now = new Date();
  return {
    current: {
      mode: 'date',
      date:
        typeof hintTimestamp === 'number'
          ? new Date(hintTimestamp)
          : new Date(now.getFullYear(), now.getMonth(), 1),
    },
  };
}

export function readEnableBirthday(
  form: IBirthdayFormState,
  earliest: IEarliestBirthday | undefined,
  networkId: string,
): { birthdayHeight?: number; birthdayTimestamp?: number } | undefined {
  if (form.fromEarliest && earliest) {
    return { birthdayHeight: earliest.height };
  }
  if (form.mode === 'height') {
    const value = form.height?.trim() ?? '';
    const height = Number(value);
    // wasm-bindgen passes Zcash heights as u32; larger integers would wrap.
    const exceedsRuntimeHeight =
      networkUtils.getNetworkImpl({ networkId }) === IMPL_ZCASH &&
      height > 4_294_967_295;
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(height) ||
      exceedsRuntimeHeight ||
      height < Math.max(1, earliest?.height ?? 1)
    ) {
      return undefined;
    }
    return { birthdayHeight: height };
  }
  if (form.mode !== 'date') return undefined;
  if (!form.date || !Number.isFinite(form.date.getTime())) return undefined;
  return {
    birthdayTimestamp: new Date(
      form.date.getFullYear(),
      form.date.getMonth(),
      form.date.getDate(),
    ).getTime(),
  };
}

export function getBirthdayInputError(mode: IBirthdayFormState['mode']) {
  return mode === 'height'
    ? ETranslations.global_bulk_accounts_page_number_error
    : ETranslations.global_select_date;
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
  networkId,
  formRef,
  currentBirthdayHeight,
  allowSavedBirthday = true,
  earliestBirthday,
}: {
  networkId: string;
  formRef: { current: IBirthdayFormState };
  currentBirthdayHeight?: number;
  allowSavedBirthday?: boolean;
  earliestBirthday?: IEarliestBirthday;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState(formRef.current.mode);
  const [fromEarliest, setFromEarliest] = useState(
    formRef.current.fromEarliest ?? false,
  );
  const [date, setDate] = useState(formRef.current.date);
  const [height, setHeight] = useState(formRef.current.height ?? '');
  const invalidHeight =
    height.length > 0 &&
    !readEnableBirthday(
      { mode: 'height', date: null, height },
      earliestBirthday,
      networkId,
    );
  let editor: React.ReactNode = null;
  if (mode === 'date') {
    editor = (
      <YStack testID="local-wallet-birthday-date-input">
        <DatePicker
          title={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          minDate={
            earliestBirthday
              ? new Date(earliestBirthday.timestamp)
              : new Date(2022, 4, 1)
          }
          maxDate={new Date()}
          value={date}
          onChange={(value) => {
            setDate(value);
            formRef.current.date = value;
          }}
        />
      </YStack>
    );
  } else if (mode === 'height') {
    editor = (
      <YStack gap="$2">
        <Input
          testID="local-wallet-birthday-height-input"
          keyboardType="number-pad"
          placeholder={intl.formatMessage({
            id: ETranslations.global_block_height,
          })}
          value={height}
          error={invalidHeight}
          onChangeText={(value) => {
            setHeight(value);
            formRef.current.height = value;
          }}
        />
        <SizableText
          testID="local-wallet-birthday-height-range"
          size="$bodySm"
          color={invalidHeight ? '$textCritical' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_block_height })} ≥{' '}
          {Math.max(1, earliestBirthday?.height ?? 1).toLocaleString('en-US')}
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
      {fromEarliest ? null : (
        <SegmentControl
          testID="local-wallet-birthday-mode"
          fullWidth
          value={mode}
          onChange={(v) => {
            const next = v as IBirthdayFormState['mode'];
            setMode(next);
            formRef.current.mode = next;
          }}
          options={[
            ...(allowSavedBirthday
              ? [
                  {
                    label: intl.formatMessage({
                      id: ETranslations.privacy_sync_start_saved__title,
                    }),
                    value: 'saved-birthday',
                    testID: 'local-wallet-birthday-mode-saved',
                  },
                ]
              : []),
            {
              label: intl.formatMessage({ id: ETranslations.global_date }),
              value: 'date',
              testID: 'local-wallet-birthday-mode-date',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.global_block_height,
              }),
              value: 'height',
              testID: 'local-wallet-birthday-mode-height',
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
      current: {
        mode: 'saved-birthday',
        date: null,
        height: currentBirthdayHeight?.toString(),
      },
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
          networkId={networkId}
          formRef={formRef}
          currentBirthdayHeight={currentBirthdayHeight}
          earliestBirthday={earliestBirthday}
        />
      ),
      onConfirmText: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      }),
      onConfirm: async ({ preventClose }) => {
        const { fromEarliest } = formRef.current;
        let mode = formRef.current.mode;
        let birthdayTimestamp: number | undefined;
        let birthdayHeightValue: number | undefined;
        if (fromEarliest && earliestBirthday) {
          mode = 'height';
          birthdayHeightValue = earliestBirthday.height;
        } else if (mode === 'date' || mode === 'height') {
          const birthday = readEnableBirthday(
            formRef.current,
            earliestBirthday,
            networkId,
          );
          if (!birthday) {
            Toast.error({
              title: intl.formatMessage({
                id: getBirthdayInputError(mode),
              }),
            });
            preventClose();
            return;
          }
          birthdayTimestamp = birthday.birthdayTimestamp;
          birthdayHeightValue = birthday.birthdayHeight;
        }
        await backgroundApiProxy.servicePrivacyChain.repairLocalChainData({
          networkId,
          accountId,
          // The existing timestamp API accepts any day, despite its mode name.
          mode: mode === 'date' ? 'month' : mode,
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

// Developer-only dump of everything the account page reads; still works when
// account metadata is missing.
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
