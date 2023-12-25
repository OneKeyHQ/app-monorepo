import { Image } from 'react-native';

import { Avatar, Stack, Text } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import type { IWalletProps } from '../../views/AccountManagerStacks/types';
import type { SizeTokens } from 'tamagui';

export interface IWalletAvatarProps {
  status?: IWalletProps['status'];
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames;
  wallet: IDBWallet | undefined;
}

export function WalletAvatarBase({
  size,
  img,
  wallet,
}: {
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames;
  wallet: IDBWallet | undefined;
}) {
  // eslint-disable-next-line no-param-reassign
  img = img || wallet?.avatarInfo?.img;
  return (
    <Avatar size={size}>
      {img ? (
        <Image
          // flex={1}
          width={40}
          height={20}
          style={{
            width: 40,
            height: 40,
          }}
          source={AllWalletAvatarImages[img] ?? AllWalletAvatarImages.bear}
        />
      ) : (
        <Text>{wallet?.avatarInfo?.emoji ?? '😀'}</Text>
      )}
    </Avatar>
  );
}

export function WalletAvatar({
  status,
  size = '$10',
  wallet,
  img,
}: IWalletAvatarProps) {
  return (
    <Stack w={size} h={size} justifyContent="center" alignItems="center">
      <WalletAvatarBase size={size} img={img} wallet={wallet} />
      {status === 'connected' && (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          bg="$bgSidebar"
          p="$0.5"
          borderRadius="$full"
          zIndex="$1"
        >
          <Stack borderRadius="$full" w="$2.5" h="$2.5" bg="$bgSuccessStrong" />
        </Stack>
      )}
    </Stack>
  );
}
