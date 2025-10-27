import { useCallback } from 'react';

import { ActionList, Dialog, useClipboard } from '@onekeyhq/components';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function WalletActionExport({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { copyText } = useClipboard();

  const { network, account, wallet } = activeAccount;

  const exportAccountCredentialKey = useCallback(
    async ({ keyType }: { keyType: ECoreApiExportedSecretKeyType }) => {
      console.log('ExportSecretKeys >>>> ', keyType);
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
      console.log('ExportSecretKeys >>>> ', r);
      console.log(
        'ExportSecretKeys >>>> ',
        wallet?.type,
        keyType,
        account?.address,
      );
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
    [
      wallet?.type,
      account?.address,
      account?.id,
      network?.id,
      copyText,
      onClose,
    ],
  );

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
