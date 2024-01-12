import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WalletOptionItem } from '../../pages/AccountSelectorStack/WalletDetails/WalletOptions/WalletOptionItem';

import { showWalletRemoveDialog } from './WalletRemoveDialog';

function getTitleAndDescription({ wallet }: { wallet?: IDBWallet }) {
  if (wallet?.type === 'hw') {
    return {
      title: 'Remove Device',
      description:
        'Device removal will permanently delete its data. Data can be recovered with a hardware wallet and recovery phrase.',
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
    <WalletOptionItem
      icon="DeleteOutline"
      label="Remove"
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
