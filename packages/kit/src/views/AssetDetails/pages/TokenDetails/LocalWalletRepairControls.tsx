import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DatePicker,
  Dialog,
  Input,
  ScrollView,
  SegmentControl,
  SizableText,
  Toast,
  XStack,
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
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

// Recovery controls for a local-wallet account. Every action goes through
// servicePrivacyChain; the copy speaks of "the chain" rather than a coin.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'month' | 'height';
  month: Date | null;
  height: string;
};

const PRIVACY_ENABLE_POINTS = [
  ETranslationsMock.privacy_enable_cost,
  ETranslationsMock.privacy_enable_foreground,
  ETranslationsMock.privacy_enable_catchup,
  ETranslationsMock.privacy_enable_local,
  ETranslationsMock.privacy_enable_unavailable,
];

// The first-time explanation docs/08 requires, shared by both enable entry
// points so the five points cannot drift apart. Repair dialogs must NOT show
// it: the account is already scanning by then.
// Above this many accounts already scanning, the enable dialog adds the
// "this gets slower" warning. Not a limit -- `maxEnabledAccounts` still caps
// it -- and deliberately not measured at runtime: a device-speed probe would
// be one more thing to keep true, and the advice ("turn some off") is the same
// whatever the reading says.
const PRIVACY_MANY_ACCOUNTS_THRESHOLD = 3;

export function PrivacyEnableDisclosure({
  hasRecommendedMonth,
  isTempWallet = false,
  enabledAccountCount = 0,
}: {
  hasRecommendedMonth: boolean;
  isTempWallet?: boolean;
  enabledAccountCount?: number;
}) {
  const intl = useIntl();
  const warnManyAccounts =
    enabledAccountCount >= PRIVACY_MANY_ACCOUNTS_THRESHOLD;
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd">
        {intl.formatMessage({ id: ETranslationsMock.privacy_enable_intro })}
      </SizableText>
      {enabledAccountCount > 0 ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslationsMock.privacy_enable_shared_scan_restart,
          })}
        </SizableText>
      ) : null}
      {warnManyAccounts ? (
        <SizableText size="$bodySm" color="$textCaution">
          {intl.formatMessage({
            id: ETranslationsMock.privacy_enable_many_accounts,
          })}
        </SizableText>
      ) : null}
      {isTempWallet ? (
        <SizableText size="$bodySm" color="$textCaution">
          {intl.formatMessage({
            id: ETranslationsMock.privacy_enable_temp_wallet_note,
          })}
        </SizableText>
      ) : null}
      <YStack gap="$1.5">
        {PRIVACY_ENABLE_POINTS.map((id) => (
          <XStack key={id} gap="$2" alignItems="flex-start">
            <SizableText size="$bodySm" color="$textSubdued">
              •
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" flex={1}>
              {intl.formatMessage({ id })}
            </SizableText>
          </XStack>
        ))}
      </YStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: hasRecommendedMonth
            ? ETranslationsMock.privacy_enable_month_recommended
            : ETranslationsMock.privacy_enable_month_required,
        })}
      </SizableText>
    </YStack>
  );
}

export function BirthdayDialogForm({
  formRef,
  currentBirthdayHeight,
  monthOnly = false,
}: {
  formRef: { current: IBirthdayFormState };
  currentBirthdayHeight?: number;
  monthOnly?: boolean;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState(formRef.current.mode);
  const [month, setMonth] = useState(formRef.current.month);
  const [height, setHeight] = useState(formRef.current.height);
  let editor = (
    <SizableText size="$bodySm" color="$textSubdued">
      {intl.formatMessage({
        id: ETranslationsMock.privacy_repair_birthday_saved_desc,
      })}
    </SizableText>
  );
  if (mode === 'month') {
    editor = (
      <YStack gap="$2">
        <DatePicker.Month
          testID="local-wallet-birthday-month-input"
          title={intl.formatMessage({
            id: ETranslationsMock.privacy_repair_month_title,
          })}
          placeholder={intl.formatMessage({
            id: ETranslationsMock.privacy_repair_month_placeholder,
          })}
          minDate={new Date(2022, 4, 1)}
          maxDate={new Date()}
          value={month}
          onChange={(value) => {
            setMonth(value);
            formRef.current.month = value;
          }}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslationsMock.privacy_repair_month_desc,
          })}
        </SizableText>
      </YStack>
    );
  } else if (mode === 'height') {
    editor = (
      <YStack gap="$2">
        <Input
          testID="local-wallet-birthday-height-input"
          placeholder={intl.formatMessage({
            id: ETranslationsMock.privacy_repair_height_placeholder,
          })}
          keyboardType="numeric"
          value={height}
          onChangeText={(v) => {
            setHeight(v);
            formRef.current.height = v;
          }}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslationsMock.privacy_repair_height_desc,
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
              id: ETranslationsMock.privacy_repair_current_birthday,
              defaultMessage: ETranslationsMock.privacy_repair_current_birthday,
            },
            { height: currentBirthdayHeight.toLocaleString('en-US') },
          )}
        </SizableText>
      ) : null}
      {monthOnly ? null : (
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
                id: ETranslationsMock.privacy_repair_mode_saved,
              }),
              value: 'saved-birthday',
            },
            {
              label: intl.formatMessage({
                id: ETranslationsMock.privacy_repair_mode_month,
              }),
              value: 'month',
            },
            {
              label: intl.formatMessage({
                id: ETranslationsMock.privacy_repair_mode_height,
              }),
              value: 'height',
            },
          ]}
        />
      )}
      {editor}
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
          id: ETranslationsMock.privacy_repair_setup_done,
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
  onDone,
}: {
  networkId: string;
  accountId: string;
  currentBirthdayHeight?: number;
  onDone: () => void;
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    const formRef: { current: IBirthdayFormState } = {
      current: { mode: 'saved-birthday', month: null, height: '' },
    };
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslationsMock.privacy_repair_scan_title,
      }),
      tone: 'warning',
      description: intl.formatMessage({
        id: ETranslationsMock.privacy_repair_scan_desc,
      }),
      renderContent: (
        <BirthdayDialogForm
          formRef={formRef}
          currentBirthdayHeight={currentBirthdayHeight}
        />
      ),
      onConfirmText: intl.formatMessage({
        id: ETranslationsMock.privacy_repair_scan_confirm,
      }),
      onConfirm: async ({ preventClose }) => {
        const { mode, month, height } = formRef.current;
        let birthdayTimestamp: number | undefined;
        let birthdayHeightValue: number | undefined;
        if (mode === 'height') {
          const parsedHeight = Number(height);
          if (!height.trim()) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslationsMock.privacy_repair_err_height,
              }),
            });
            preventClose();
            return;
          }
          birthdayHeightValue = parsedHeight;
        } else if (mode === 'month') {
          if (!month) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslationsMock.privacy_repair_err_month,
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
        Toast.success({
          title: intl.formatMessage({
            id: ETranslationsMock.privacy_repair_scan_started,
          }),
        });
        onDone();
      },
    });
  }, [networkId, accountId, currentBirthdayHeight, onDone, intl]);

  return (
    <Button
      testID="local-wallet-repair-scan-btn"
      size="small"
      variant="tertiary"
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslationsMock.privacy_repair_action })}
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
