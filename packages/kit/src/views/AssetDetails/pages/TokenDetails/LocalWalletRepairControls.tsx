import { useCallback, useState } from 'react';

import {
  Button,
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

// Recovery controls for a local-wallet account. Every action goes through
// servicePrivacyChain; the copy speaks of "the chain" rather than a coin.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'month' | 'height';
  month: Date | null;
  height: string;
};

export function BirthdayDialogForm({
  formRef,
  currentBirthdayHeight,
  monthOnly = false,
}: {
  formRef: { current: IBirthdayFormState };
  currentBirthdayHeight?: number;
  monthOnly?: boolean;
}) {
  const [mode, setMode] = useState(formRef.current.mode);
  const [month, setMonth] = useState(formRef.current.month);
  const [height, setHeight] = useState(formRef.current.height);
  let editor = (
    <SizableText size="$bodySm" color="$textSubdued">
      Rebuilds the scanner and local history from the currently saved birthday.
    </SizableText>
  );
  if (mode === 'month') {
    editor = (
      <YStack gap="$2">
        <DatePicker.Month
          testID="local-wallet-birthday-month-input"
          title="Approximate first activity"
          placeholder="Select month"
          minDate={new Date(2022, 4, 1)}
          maxDate={new Date()}
          value={month}
          onChange={(value) => {
            setMonth(value);
            formRef.current.month = value;
          }}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          Pick a month on or before the first time this account received funds.
          Earlier only makes the rescan slower; later can miss funds.
        </SizableText>
      </YStack>
    );
  } else if (mode === 'height') {
    editor = (
      <YStack gap="$2">
        <Input
          testID="local-wallet-birthday-height-input"
          placeholder="e.g. 3400000"
          keyboardType="numeric"
          value={height}
          onChangeText={(v) => {
            setHeight(v);
            formRef.current.height = v;
          }}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          Advanced: the scan restarts exactly from this block.
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$3">
      {typeof currentBirthdayHeight === 'number' ? (
        <SizableText size="$bodySm" color="$textSubdued">
          This account currently scans from block{' '}
          {currentBirthdayHeight.toLocaleString('en-US')}.
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
            { label: 'Saved birthday', value: 'saved-birthday' },
            { label: 'Approx. month', value: 'month' },
            { label: 'Block height', value: 'height' },
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
  const [busy, setBusy] = useState(false);
  const handlePress = useCallback(async () => {
    setBusy(true);
    try {
      await backgroundApiProxy.servicePrivacyChain.retryLocalWalletAccountSetup(
        { networkId, accountId },
      );
      Toast.success({ title: 'Setup completed' });
      onDone();
    } catch (e) {
      // Background errors auto-toast through the standard proxy.
      console.error('[privacyChain] retryLocalWalletAccountSetup failed', e);
    } finally {
      setBusy(false);
    }
  }, [networkId, accountId, onDone]);

  return (
    <Button
      testID="local-wallet-repair-setup-btn"
      size="small"
      variant="tertiary"
      loading={busy}
      onPress={handlePress}
    >
      Repair
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
  const handlePress = useCallback(() => {
    const formRef: { current: IBirthdayFormState } = {
      current: { mode: 'saved-birthday', month: null, height: '' },
    };
    Dialog.confirm({
      title: 'Repair local scan',
      tone: 'warning',
      description:
        'This clears only rebuildable scanner data and local history, then rescans. Keys and funds are not touched. Choose a month earlier than the first activity; earlier is slower but safer.',
      renderContent: (
        <BirthdayDialogForm
          formRef={formRef}
          currentBirthdayHeight={currentBirthdayHeight}
        />
      ),
      onConfirmText: 'Repair and rescan',
      onConfirm: async ({ preventClose }) => {
        const { mode, month, height } = formRef.current;
        let birthdayTimestamp: number | undefined;
        let birthdayHeightValue: number | undefined;
        if (mode === 'height') {
          const parsedHeight = Number(height);
          if (
            !height ||
            !Number.isSafeInteger(parsedHeight) ||
            parsedHeight <= 0
          ) {
            Toast.error({ title: 'Enter a valid block height' });
            preventClose();
            return;
          }
          birthdayHeightValue = parsedHeight;
        } else if (mode === 'month') {
          if (!month) {
            Toast.error({ title: 'Select an approximate month' });
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
        Toast.success({ title: 'Local scan rebuilding' });
        onDone();
      },
    });
  }, [networkId, accountId, currentBirthdayHeight, onDone]);

  return (
    <Button
      testID="local-wallet-repair-scan-btn"
      size="small"
      variant="tertiary"
      onPress={handlePress}
    >
      Repair
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
