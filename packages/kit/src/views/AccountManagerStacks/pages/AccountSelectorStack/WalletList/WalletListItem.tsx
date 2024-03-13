import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, useMedia } from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

interface IWalletListItemProps extends IStackProps {
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
      userSelect="none"
      // hidden wallet use dark bg
      // @ts-expect-error
      bg={accountUtils.isHwHiddenWallet({ wallet }) ? '$bgInfo' : undefined}
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
