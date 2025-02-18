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

export default WalletItem;
