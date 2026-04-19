import { useCallback, useMemo } from 'react';

import { ActionList, Dialog, useClipboard } from '@onekeyhq/components';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldHideBotWalletExport } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletActionExport({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { copyText } = useClipboard();

  const { network, account, wallet } = activeAccount;
  const isBotWallet = useMemo(
    () => accountUtils.isBotWallet({ walletId: wallet?.id }),
    [wallet?.id],
  );
  const { result: isBotWalletDeactivatedResult } = usePromiseResult(
    async () => {
      if (!wallet?.id || !isBotWallet) {
        return false;
      }

      return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
        walletId: wallet.id,
      });
    },
    [wallet?.id, isBotWallet],
    {
      checkIsFocused: false,
    },
  );
  const isBotWalletDeactivated = !!isBotWalletDeactivatedResult;

  const exportAccountCredentialKey = useCallback(
    async ({ keyType }: { keyType: ECoreApiExportedSecretKeyType }) => {
      let r: string | undefined = '';
      if (
        keyType === ECoreApiExportedSecretKeyType.xpub ||
        keyType === ECoreApiExportedSecretKeyType.publicKey
      ) {
        r = await backgroundApiProxy.serviceAccount.exportAccountPublicKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      } else {
        r = await backgroundApiProxy.serviceAccount.exportAccountSecretKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      }
      Dialog.show({
        title: 'Key',
        description: r,
        onConfirmText: 'Copy',
        onConfirm() {
          copyText(r || '');
        },
      });
      onClose();
    },
    [account?.id, network?.id, copyText, onClose],
  );

  if (
    shouldHideBotWalletExport({
      isBotWallet,
      isBotWalletDeactivated,
    })
  ) {
    return null;
  }

  return (
    <>
      <ActionList.Item
        trackID="wallet-export-public-key"
        icon="MinusLargeOutline"
        label="Export Public Key"
        onClose={() => {}}
        onPress={() => {
          defaultLogger.wallet.walletActions.actionExportPublicKey({
            walletType: wallet?.type ?? '',
            networkId: network?.id ?? '',
            source: 'homePage',
          });
          void exportAccountCredentialKey({
            keyType: ECoreApiExportedSecretKeyType.publicKey,
          });
        }}
      />
      <ActionList.Item
        trackID="wallet-export-xpub"
        icon="MinusLargeOutline"
        label="Export xpub"
        onClose={() => {}}
        onPress={() => {
          defaultLogger.wallet.walletActions.actionExportXpub({
            walletType: wallet?.type ?? '',
            networkId: network?.id ?? '',
            source: 'homePage',
          });
          void exportAccountCredentialKey({
            keyType: ECoreApiExportedSecretKeyType.xpub,
          });
        }}
      />
      <ActionList.Item
        trackID="wallet-export-private-key"
        icon="MinusLargeOutline"
        label="Export Private Key"
        onClose={() => {}}
        onPress={() => {
          defaultLogger.wallet.walletActions.actionExportPrivateKey({
            walletType: wallet?.type ?? '',
            networkId: network?.id ?? '',
            source: 'homePage',
          });
          void exportAccountCredentialKey({
            keyType: ECoreApiExportedSecretKeyType.privateKey,
          });
        }}
      />
      <ActionList.Item
        trackID="wallet-export-xprvt"
        icon="MinusLargeOutline"
        label="Export xprvt"
        onClose={() => {}}
        onPress={() => {
          defaultLogger.wallet.walletActions.actionExportXprvt({
            walletType: wallet?.type ?? '',
            networkId: network?.id ?? '',
            source: 'homePage',
          });
          void exportAccountCredentialKey({
            keyType: ECoreApiExportedSecretKeyType.xprvt,
          });
        }}
      />
    </>
  );
}
