import { useCallback, useEffect, useState } from 'react';

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
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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

// Recovery controls for a local-wallet account; every action goes through servicePrivacyChain.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'date' | 'height';
  date: Date | null;
  height?: string;
  fromEarliest?: boolean;
  // The chain tip once known; a height above it is not a valid sync start.
  maxHeight?: number;
};

export type IEarliestBirthday = { height: number; timestamp: number };

function getBirthdayCalendarDate(timestamp: number): Date {
  const date = new Date(timestamp);
  // Activation metadata represents a UTC calendar day, not a local instant.
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function createEnableBirthdayForm(
  hintTimestamp?: number,
  earliestBirthday?: IEarliestBirthday,
): {
  current: IBirthdayFormState;
} {
  const now = new Date();
  const suggestedDate =
    typeof hintTimestamp === 'number'
      ? new Date(hintTimestamp)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliestDate = earliestBirthday
    ? getBirthdayCalendarDate(earliestBirthday.timestamp)
    : undefined;
  return {
    current: {
      mode: 'date',
      date:
        earliestDate && suggestedDate < earliestDate
          ? earliestDate
          : suggestedDate,
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
      height < Math.max(1, earliest?.height ?? 1) ||
      (form.maxHeight !== undefined && height > form.maxHeight)
    ) {
      return undefined;
    }
    return { birthdayHeight: height };
  }
  if (form.mode !== 'date') return undefined;
  if (!form.date || !Number.isFinite(form.date.getTime())) return undefined;
  if (earliest && form.date < getBirthdayCalendarDate(earliest.timestamp)) {
    return undefined;
  }
  return {
    birthdayTimestamp: new Date(
      form.date.getFullYear(),
      form.date.getMonth(),
      form.date.getDate(),
    ).getTime(),
  };
}

// A rejected height names the bound it breaks; anything else is just invalid.
export function getBirthdayHeightHint({
  height,
  invalid,
  minHeight,
  maxHeight,
  label,
  invalidText,
  format = (value: number) => value.toLocaleString('en-US'),
}: {
  height: string;
  invalid: boolean;
  minHeight: number;
  maxHeight?: number;
  label: string;
  invalidText: string;
  format?: (value: number) => string;
}): string {
  if (!invalid) {
    return maxHeight === undefined
      ? `${label} ≥ ${format(minHeight)}`
      : `${label} ${format(minHeight)} – ${format(maxHeight)}`;
  }
  const isWholeNumber = /^\d+$/.test(height);
  const value = Number(height);
  if (isWholeNumber && value < minHeight) {
    return `${label} ≥ ${format(minHeight)}`;
  }
  if (isWholeNumber && maxHeight !== undefined && value > maxHeight) {
    return `${label} ≤ ${format(maxHeight)}`;
  }
  return invalidText;
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
  const [heightTouched, setHeightTouched] = useState(false);
  const locked = fromEarliest && !!earliestBirthday;
  const displayedMode = locked && mode === 'saved-birthday' ? 'date' : mode;
  const earliestDate = earliestBirthday
    ? getBirthdayCalendarDate(earliestBirthday.timestamp)
    : undefined;
  const minDate = earliestDate ?? new Date(2022, 4, 1);
  const displayedHeight = locked ? String(earliestBirthday.height) : height;
  const displayedBirthdayHeight = locked
    ? earliestBirthday.height
    : currentBirthdayHeight;
  // Shown without waiting; the upper bound applies once the tip is known.
  const { result: chainTip } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePrivacyChain.getLocalWalletLatestHeight({
        networkId,
      }),
    [networkId],
  );
  const maxHeight = chainTip ?? undefined;
  useEffect(() => {
    formRef.current.maxHeight = maxHeight;
  }, [formRef, maxHeight]);
  const invalidHeight =
    !locked &&
    height.length > 0 &&
    !readEnableBirthday(
      { mode: 'height', date: null, height, maxHeight },
      earliestBirthday,
      networkId,
    );
  const showHeightError =
    displayedMode === 'height' && heightTouched && invalidHeight;
  const minHeight = Math.max(1, earliestBirthday?.height ?? 1);
  let editor: React.ReactNode = null;
  if (displayedMode === 'date') {
    editor = (
      <YStack testID="local-wallet-birthday-date-input">
        <DatePicker
          title={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          minDate={minDate}
          maxDate={new Date()}
          disabled={locked}
          showTodayShortcut={false}
          value={locked ? earliestDate : date}
          onChange={(value) => {
            if (locked) return;
            setDate(value);
            formRef.current.date = value;
          }}
        />
      </YStack>
    );
  } else if (displayedMode === 'height') {
    editor = (
      <Input
        testID="local-wallet-birthday-height-input"
        size="small"
        keyboardType="number-pad"
        placeholder={intl.formatMessage({
          id: ETranslations.global_block_height,
        })}
        value={displayedHeight}
        disabled={locked}
        error={showHeightError}
        onBlur={() => setHeightTouched(true)}
        onChangeText={(value) => {
          if (locked) return;
          setHeight(value);
          formRef.current.height = value;
        }}
      />
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
            {
              height: intl.formatNumber(
                displayedBirthdayHeight ?? currentBirthdayHeight,
              ),
            },
          )}
        </SizableText>
      ) : null}
      <SegmentControl
        testID="local-wallet-birthday-mode"
        fullWidth
        value={displayedMode}
        pointerEvents={locked ? 'none' : 'auto'}
        aria-disabled={locked}
        onChange={(v) => {
          if (locked) return;
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
                  disabled: locked,
                },
              ]
            : []),
          {
            label: intl.formatMessage({ id: ETranslations.global_date }),
            value: 'date',
            testID: 'local-wallet-birthday-mode-date',
            disabled: locked,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.global_block_height,
            }),
            value: 'height',
            testID: 'local-wallet-birthday-mode-height',
            disabled: locked,
          },
        ]}
      />
      {editor ? (
        <YStack gap="$1">
          {editor}
          <YStack minHeight="$5">
            {showHeightError ? (
              <SizableText
                testID="local-wallet-birthday-height-error"
                size="$bodySm"
                color="$textCritical"
                accessibilityRole="alert"
              >
                {getBirthdayHeightHint({
                  height: height.trim(),
                  invalid: true,
                  minHeight,
                  maxHeight,
                  label: intl.formatMessage({
                    id: ETranslations.global_block_height,
                  }),
                  invalidText: intl.formatMessage({
                    id: getBirthdayInputError('height'),
                  }),
                  format: (value) => intl.formatNumber(value),
                })}
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
      ) : null}
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
            labelContainerProps={{ flex: 1 }}
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
  onError,
}: {
  networkId: string;
  accountId: string;
  onDone: () => void;
  // A failed repair can change what the caller shows (e.g. identity mismatch).
  onError?: () => void;
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
      console.error('[privacyChain] retryLocalWalletAccountSetup failed', e);
      onError?.();
    } finally {
      setBusy(false);
    }
  }, [networkId, accountId, onDone, onError, intl]);

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
        }
        if (mode === 'date' || mode === 'height') {
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
