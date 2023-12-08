import { useWalletActions } from './hooks';
import { WalletOptionItem } from './WalletOptionItem';

import type { IWalletDetailsProps } from '..';

export function RemoveWallet({ wallet }: IWalletDetailsProps) {
  function getTitleAndDescription() {
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

  const { title, description } = getTitleAndDescription();

  const { remove } = useWalletActions();
  return (
    <WalletOptionItem
      icon="DeleteOutline"
      label="Remove"
      onPress={async () => {
        await remove({
          checked: false,
          title,
          description,
        });
      }}
    />
  );
}
