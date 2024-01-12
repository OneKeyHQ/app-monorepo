import { useState } from 'react';

import { Dialog, IconButton, Input, useMedia } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export function WalletRenameDialog({ wallet }: { wallet: IDBWallet }) {
  const { serviceAccount } = backgroundApiProxy;
  const media = useMedia();
  const [name, setName] = useState(wallet?.name || '');
  return (
    <>
      <Input
        value={name}
        onChangeText={setName}
        size={media.gtMd ? 'medium' : 'large'}
        autoFocus
      />
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !name,
        }}
        onConfirm={async () => {
          if (wallet?.id && name) {
            await serviceAccount.setWalletNameAndAvatar({
              walletId: wallet?.id,
              name,
            });
          }
        }}
      />
    </>
  );
}

export function WalletRenameButton({ wallet }: { wallet: IDBWallet }) {
  return (
    <IconButton
      title="Rename"
      icon="PencilOutline"
      size="small"
      variant="tertiary"
      $platform-native={{
        hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
      }}
      onPress={() =>
        Dialog.show({
          title: 'Rename',
          renderContent: <WalletRenameDialog wallet={wallet} />,
        })
      }
    />
  );
}
