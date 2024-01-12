import { SizableText, Stack, useMedia } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { WalletAvatar } from '@onekeyhq/kit/src/../components/WalletAvatar';

import type { IWalletAvatarProps } from '@onekeyhq/kit/src/../components/WalletAvatar';
import type { StackProps } from 'tamagui';

interface IWalletListItemProps extends StackProps {
  selected?: boolean;
  walletAvatarProps?: IWalletAvatarProps;
  walletName?: string;
  wallet: IDBWallet | undefined;
}

export function WalletListItem({
  selected,
  walletAvatarProps,
  wallet,
  walletName,
  ...rest
}: IWalletListItemProps) {
  const media = useMedia();

  return (
    <Stack
      alignItems="center"
      mx="$2"
      p="$1"
      borderRadius="$3"
      style={{
        borderCurve: 'continuous',
      }}
      {...(selected
        ? {
            bg: '$bgActive',
          }
        : {
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
      {...rest}
    >
      {walletAvatarProps ? <WalletAvatar {...walletAvatarProps} /> : null}
      {media.gtMd && (
        <SizableText
          flex={1}
          numberOfLines={1}
          mt="$1"
          size="$bodySm"
          color={selected ? '$text' : '$textSubdued'}
        >
          {walletName}
        </SizableText>
      )}
    </Stack>
  );
}
