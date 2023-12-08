import { Stack, Text, useMedia } from '@onekeyhq/components';

import { WalletAvatar } from './WalletAvatar';

import type { IWalletAvatarProps } from './WalletAvatar';
import type { StackProps } from 'tamagui';

interface IWalletListItemProps extends StackProps {
  selected?: boolean;
  walletAvatarProps?: IWalletAvatarProps;
  walletName?: string;
}

export function WalletListItem({
  selected,
  walletAvatarProps,
  walletName,
  ...rest
}: IWalletListItemProps) {
  const media = useMedia();

  return (
    <Stack
      alignItems="center"
      mx="$2"
      p="$1"
      borderRadius="$2"
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
      <WalletAvatar {...walletAvatarProps} />
      {media.gtMd && (
        <Text
          flex={1}
          numberOfLines={1}
          mt="$1"
          variant="$bodySm"
          color={selected ? '$text' : '$textSubdued'}
        >
          {walletName}
        </Text>
      )}
    </Stack>
  );
}
