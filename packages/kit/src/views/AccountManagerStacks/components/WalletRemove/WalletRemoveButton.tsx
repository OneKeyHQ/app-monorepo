import { IconButton } from '@onekeyhq/components';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showWalletRemoveDialog } from './WalletRemoveDialog';

function getTitleAndDescription({ wallet }: { wallet?: IDBWallet }) {
  if (wallet?.type === 'hw') {
    if (
      accountUtils.isHwHiddenWallet({
        wallet,
      })
    ) {
      return {
        title: 'Remove Device',
        description:
          'This will permanently delete your data. Ensure you have saved the passphrase of this hidden wallet',
      };
    }
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
          showCheckBox: wallet?.type !== 'hw',
          defaultChecked: false,
          wallet,
        });
      }}
    />
  );
}
