import { Stack } from '@onekeyhq/components';

import { type IWalletItem, WalletItem } from './WalletItem';

interface IWalletListProps {
  wallets: IWalletItem[];
  onWalletListSelectChange?: (selectedWallets: IWalletItem[]) => void;
  onSelectWallet?: (wallet: IWalletItem) => void;
  multiSelect?: boolean;
}

function WalletList({
  wallets,
  onWalletListSelectChange,
  onSelectWallet,
  multiSelect = false,
}: IWalletListProps) {
  const getUpdatedSelection = (
    currentWallet: IWalletItem,
    selectedWallet: IWalletItem,
    isMultiSelect: boolean,
  ) => {
    if (currentWallet.id !== selectedWallet.id) {
      return currentWallet.selected;
    }
    return isMultiSelect ? !currentWallet.selected : true;
  };

  const handleWalletSelect = (wallet: IWalletItem) => {
    onSelectWallet?.(wallet);

    if (onWalletListSelectChange) {
      console.log('onWalletListSelectChange', wallet);
      const updatedWallets = wallets.map((w) => ({
        ...w,
        selected: getUpdatedSelection(w, wallet, multiSelect),
      }));
      onWalletListSelectChange(updatedWallets.filter((w) => w.selected));
    }
  };

  return (
    <Stack gap="$4">
      {wallets.map((wallet) => (
        <WalletItem
          key={wallet.id}
          wallet={wallet}
          onSelect={handleWalletSelect}
        />
      ))}
    </Stack>
  );
}

export default WalletList;
