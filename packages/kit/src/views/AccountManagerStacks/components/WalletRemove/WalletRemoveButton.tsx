import { IconButton } from '@onekeyhq/components';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { showWalletRemoveDialog } from './WalletRemoveDialog';

function getTitleAndDescription({ wallet }: { wallet?: IDBWallet }) {
  if (wallet?.type === 'hw') {
    return {
      title: 'Remove Device',
      description:
        'This will permanently delete your data. But you still can restore it from the hardware wallet which is loaded the recovery phrase of this wallet.',
    };
  }

  return {
    title: 'Remove Wallet',
    description:
      'Make sure you’ve written down the recovery phrase before removing the wallet. Otherwise, you won’t be able to recover the wallet.',
  };
}

export function WalletRemoveButton({ wallet }: { wallet?: IDBWallet }) {
  const { title, description } = getTitleAndDescription({ wallet });
  const { config } = useAccountSelectorContextData();
  return (
    <IconButton
      title="Remove"
      icon="DeleteOutline"
      variant="tertiary"
      onPress={() => {
        showWalletRemoveDialog({
          config,
          title,
          description,
          defaultChecked: false,
          wallet,
        });
      }}
    />
  );
}
