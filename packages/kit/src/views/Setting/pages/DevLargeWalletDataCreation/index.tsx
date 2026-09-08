import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Page,
  Progress,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

type ILargeWalletDataCreationProgress =
  IAppEventBusPayload[EAppEventBusNames.DevLargeWalletDataCreationProgress];

const INITIAL_PROGRESS: ILargeWalletDataCreationProgress = {
  isRunning: false,
  walletIndex: 0,
  walletsCreated: 0,
  walletsTotal: 10,
  accountsCreatedInWallet: 0,
  accountsPerWallet: 100,
  accountsCreated: 0,
  accountsTotal: 1000,
};

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'Unknown error';
}

export default function DevLargeWalletDataCreation() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);

  useEffect(() => {
    const handleProgress = (value: ILargeWalletDataCreationProgress) => {
      setProgress(value);
      setIsRunning(value.isRunning);
    };
    appEventBus.on(
      EAppEventBusNames.DevLargeWalletDataCreationProgress,
      handleProgress,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.DevLargeWalletDataCreationProgress,
        handleProgress,
      );
    };
  }, []);

  const handleCreate = useCallback(
    async (walletCount: 10 | 100) => {
      if (isRunning) {
        return;
      }

      setProgress({
        ...INITIAL_PROGRESS,
        walletsTotal: walletCount,
        accountsTotal: walletCount * INITIAL_PROGRESS.accountsPerWallet,
      });
      setIsRunning(true);
      try {
        const result =
          await backgroundApiProxy.serviceDemo.createLargeWalletsAndAccounts({
            walletCount,
          });
        Toast.success({
          title: 'Real HD wallet data ready',
          message: `${result.walletsCreated.toLocaleString()} wallet(s) and ${result.accountsCreated.toLocaleString()} account(s) created in ${(
            result.durationMs / 1000
          ).toFixed(1)}s`,
        });
      } catch (error) {
        Toast.error({
          title: 'Failed to create real HD wallet data',
          message: getErrorMessage(error),
        });
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning],
  );

  const progressPercent = Math.min(
    100,
    Math.max(0, (progress.accountsCreated / progress.accountsTotal) * 100),
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Large HD Wallet Data" />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$5">
          <YStack gap="$2">
            <SizableText size="$headingLg">Create Real HD Wallets</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              Choose 10 or 100 independent HD wallets with encrypted recovery
              phrases and 100 indexed accounts in each wallet. The wallets
              support normal address derivation, signing, wallet operations, and
              cloud sync.
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              The page uses the current unlocked session without asking for a
              password. Recovery phrases are never shown or logged. Keep the app
              open until creation finishes. Each run adds another complete data
              set.
            </SizableText>
          </YStack>

          <YStack gap="$3">
            <Progress value={progressPercent} w="100%" size="medium" />
            <SizableText size="$headingMd">
              {progressPercent.toFixed(1)}%
            </SizableText>
            <YStack gap="$1">
              <SizableText size="$bodyMdMedium">
                Current wallet: {progress.walletIndex.toLocaleString()} /{' '}
                {progress.walletsTotal.toLocaleString()}
              </SizableText>
              <SizableText size="$bodyMd">
                Wallets created: {progress.walletsCreated.toLocaleString()} /{' '}
                {progress.walletsTotal.toLocaleString()}
              </SizableText>
              <SizableText size="$bodyMd">
                Accounts in current wallet:{' '}
                {progress.accountsCreatedInWallet.toLocaleString()} /{' '}
                {progress.accountsPerWallet.toLocaleString()}
              </SizableText>
              <SizableText size="$bodyMd">
                Total accounts: {progress.accountsCreated.toLocaleString()} /{' '}
                {progress.accountsTotal.toLocaleString()}
              </SizableText>
            </YStack>
          </YStack>

          <YStack gap="$3">
            {([10, 100] as const).map((walletCount) => (
              <Button
                key={walletCount}
                variant="destructive"
                size="large"
                loading={isRunning && progress.walletsTotal === walletCount}
                disabled={isRunning}
                testID={`create-large-wallet-account-data-start-${walletCount}`}
                onPress={() => {
                  void handleCreate(walletCount);
                }}
              >
                {walletCount} Wallets × 100 Accounts
              </Button>
            ))}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
