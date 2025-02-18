import {
  Checkbox,
  Image,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

export interface IWalletItem {
  id: string;
  name: string;
  image?: string;
  balance?: string;
  selected?: boolean;
}

interface IWalletListProps {
  wallets: IWalletItem[];
  onWalletListSelectChange?: (selectedWallets: IWalletItem[]) => void;
  onSelectWallet?: (wallet: IWalletItem) => void;
  multiSelect?: boolean;
}

export function WalletList({
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
      return isMultiSelect ? currentWallet.selected : false;
    }
    return isMultiSelect ? !currentWallet.selected : true;
  };

  const handleWalletSelect = (wallet: IWalletItem) => {
    if (onSelectWallet) {
      onSelectWallet(wallet);
    }

    if (onWalletListSelectChange) {
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
        <XStack
          key={wallet.id}
          p="$4"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => handleWalletSelect(wallet)}
        >
          <XStack gap="$3" alignItems="center" flex={1}>
            <Checkbox
              value={wallet.selected}
              onChange={() => handleWalletSelect(wallet)}
            />
            {wallet.image ? (
              <Image
                width={40}
                height={40}
                borderRadius="$2"
                source={{ uri: wallet.image }}
              />
            ) : null}
            <SizableText size="$bodyLg">{wallet.name}</SizableText>
          </XStack>
          {wallet.balance ? (
            <SizableText size="$bodyLg" color="$textSubdued">
              {wallet.balance}
            </SizableText>
          ) : null}
        </XStack>
      ))}
    </Stack>
  );
}

export default WalletList;
