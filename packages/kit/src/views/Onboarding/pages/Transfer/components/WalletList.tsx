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
  accountCount: number;
  selected?: boolean;
}

interface IWalletItemProps {
  wallet: IWalletItem;
  onSelect: (wallet: IWalletItem) => void;
}

export function WalletItem({ wallet, onSelect }: IWalletItemProps) {
  return (
    <XStack
      onPress={() => onSelect(wallet)}
      p="$4"
      borderRadius="$3"
      backgroundColor="$bgSubdued"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack gap="$3" alignItems="center" flex={1}>
        <Checkbox value={wallet.selected} onChange={() => onSelect(wallet)} />
        {wallet.image ? (
          <Stack
            width={32}
            height={32}
            borderRadius="$full"
            backgroundColor="$bgStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Image
              width={24}
              height={24}
              borderRadius="$full"
              source={{ uri: wallet.image }}
            />
          </Stack>
        ) : null}
        <Stack gap="$1">
          <SizableText size="$bodyLg" color="$text">
            {wallet.name}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${wallet.accountCount} accounts`}
          </SizableText>
        </Stack>
      </XStack>
    </XStack>
  );
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
