import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  DatePicker,
  Dialog,
  Input,
  Select,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  formatDate,
  formatDateFns,
} from '@onekeyhq/shared/src/utils/dateUtils';

const defaultDevOnlyPassword =
  process.env.NODE_ENV !== 'production'
    ? `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`
    : '';

function normalizeWalletCreatedAt(walletCreatedAt: Date | null) {
  if (!walletCreatedAt) {
    return undefined;
  }

  return new Date(
    Date.UTC(
      walletCreatedAt.getFullYear(),
      walletCreatedAt.getMonth(),
      walletCreatedAt.getDate(),
      0,
      0,
      0,
    ),
  ).toISOString();
}

function shortenAddress(address: string) {
  if (address.length <= 16) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

type IReferralWalletOption = {
  label: string;
  value: string;
  address: string;
  networkId: string;
};

export function ReferralCodeDebugPanel({
  activeWalletId,
  activeWalletName,
}: {
  activeWalletId?: string;
  activeWalletName?: string;
}) {
  const [devOnlyPassword, setDevOnlyPassword] = useState(
    defaultDevOnlyPassword,
  );
  const [walletCreatedAtDate, setWalletCreatedAtDate] = useState<Date | null>(
    null,
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    result: walletOptions,
    isLoading,
    run: reloadWalletOptions,
  } = usePromiseResult(
    async () => {
      const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
        nestedHiddenWallets: false,
      });

      const options = await Promise.all(
        wallets.map(async (wallet) => {
          const walletInfo =
            await backgroundApiProxy.serviceReferralCode.getReferralCodeWalletInfo(
              {
                walletId: wallet.id,
              },
            );
          if (!walletInfo) {
            return null;
          }

          return {
            label: `${wallet.name} · ${shortenAddress(walletInfo.address)}`,
            value: wallet.id,
            address: walletInfo.address,
            networkId: walletInfo.networkId,
          } satisfies IReferralWalletOption;
        }),
      );
      return options.filter((item): item is IReferralWalletOption =>
        Boolean(item),
      );
    },
    [],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );

  useEffect(() => {
    if (!walletOptions?.length) {
      setSelectedWalletId(undefined);
      return;
    }

    setSelectedWalletId((prev) => {
      if (prev && walletOptions.some((item) => item.value === prev)) {
        return prev;
      }
      if (
        activeWalletId &&
        walletOptions.some((item) => item.value === activeWalletId)
      ) {
        return activeWalletId;
      }
      return walletOptions[0].value;
    });
  }, [activeWalletId, walletOptions]);

  const selectedWallet = useMemo(
    () => walletOptions?.find((item) => item.value === selectedWalletId),
    [selectedWalletId, walletOptions],
  );

  const statusText = useMemo(() => {
    if (isLoading) {
      return 'Loading available wallet referral addresses...';
    }
    if (!walletOptions?.length) {
      return 'No supported HD/HW wallet referral address was found.';
    }
    if (!selectedWallet) {
      return 'Select a wallet address to continue.';
    }
    return selectedWallet.address;
  }, [isLoading, selectedWallet, walletOptions]);

  const handleUnbind = useCallback(async () => {
    if (!selectedWallet) {
      Toast.error({
        title: 'Select a wallet address first.',
      });
      return;
    }

    const normalizedWalletCreatedAt =
      normalizeWalletCreatedAt(walletCreatedAtDate);

    setIsSubmitting(true);
    try {
      const devOnlyParams: IBackgroundMethodWithDevOnlyPassword = {
        $$devOnlyPassword: devOnlyPassword,
      };
      const result =
        await backgroundApiProxy.serviceReferralCode.devUnbindWallet(
          devOnlyParams,
          {
            walletId: selectedWallet.value,
            walletCreatedAt: normalizedWalletCreatedAt,
          },
        );
      await reloadWalletOptions();
      Toast.success({
        title: 'Referral wallet status updated.',
      });
      Dialog.debugMessage({
        title: 'Referral Bind Debug Result',
        debugMessage: result,
      });
    } catch (error) {
      Toast.error({
        title: 'Referral debug action failed.',
        message: (error as Error).message || String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    devOnlyPassword,
    reloadWalletOptions,
    selectedWallet,
    walletCreatedAtDate,
  ]);

  const selectItems = useMemo(
    () =>
      walletOptions?.map((item) => ({
        label: item.label,
        value: item.value,
      })) ?? [],
    [walletOptions],
  );

  return (
    <YStack gap="$4" p="$2">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Dev password</SizableText>
        <Input
          value={devOnlyPassword}
          onChangeText={setDevOnlyPassword}
          placeholder="yyyyMMdd-onekey-debug"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </YStack>

      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">Current wallet</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {activeWalletName ?? 'N/A'}
        </SizableText>
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Wallet address</SizableText>
        <Select
          title="Referral Wallet Address"
          items={selectItems}
          value={selectedWalletId}
          onChange={setSelectedWalletId}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {statusText}
        </SizableText>
      </YStack>

      {selectedWallet ? (
        <YStack gap="$1">
          <SizableText size="$bodyMdMedium">Network</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {selectedWallet.networkId}
          </SizableText>
        </YStack>
      ) : null}

      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMdMedium">
            walletCreatedAt (optional)
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            disabled={!walletCreatedAtDate}
            onPress={() => setWalletCreatedAtDate(null)}
          >
            Clear
          </Button>
        </XStack>
        <DatePicker
          value={walletCreatedAtDate}
          onChange={setWalletCreatedAtDate}
          placeholder="Select wallet creation date"
          maxDate={new Date()}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {walletCreatedAtDate
            ? `Selected ${formatDate(walletCreatedAtDate, {
                hideTimeForever: true,
              })}, submitted as ${normalizeWalletCreatedAt(walletCreatedAtDate)}`
            : 'Leave this empty to only unbind. Select a date to overwrite the recorded wallet creation time.'}
        </SizableText>
      </YStack>

      <Button
        variant="destructive"
        loading={isSubmitting}
        disabled={!selectedWallet || isLoading || !devOnlyPassword.trim()}
        onPress={handleUnbind}
      >
        Dev Unbind Referral Wallet
      </Button>
    </YStack>
  );
}
