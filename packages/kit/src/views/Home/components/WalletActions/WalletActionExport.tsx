import { useCallback } from 'react';

import { ActionList, Dialog, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldHideBotWalletExport } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/shared/src/types/coreEnums';

export function WalletActionExport({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { copyText } = useClipboard();

  const { network, account, wallet } = activeAccount;
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );

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
