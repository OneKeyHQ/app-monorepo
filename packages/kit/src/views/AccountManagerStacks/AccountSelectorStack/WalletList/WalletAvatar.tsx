import { Image } from 'react-native';

import { Avatar, Stack, Text } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IWalletProps } from '../../types';
import type { SizeTokens } from 'tamagui';

export const HdWalletAvatarImages = {
  bear: require('../../../../../assets/wallet/avatar/Bear.png'),
  cat: require('../../../../../assets/wallet/avatar/Cat.png'),
  cow: require('../../../../../assets/wallet/avatar/Cow.png'),
  dog: require('../../../../../assets/wallet/avatar/Dog.png'),
  fox: require('../../../../../assets/wallet/avatar/Fox.png'),
  frog: require('../../../../../assets/wallet/avatar/Frog.png'),
  koala: require('../../../../../assets/wallet/avatar/Koala.png'),
  lion: require('../../../../../assets/wallet/avatar/Lion.png'),
  monkey: require('../../../../../assets/wallet/avatar/Monkey.png'),
  panda: require('../../../../../assets/wallet/avatar/Panda.png'),
  pig: require('../../../../../assets/wallet/avatar/Pig.png'),
  polarBear: require('../../../../../assets/wallet/avatar/PolarBear.png'),
  rabbit: require('../../../../../assets/wallet/avatar/Rabbit.png'),
  raccoon: require('../../../../../assets/wallet/avatar/Raccoon.png'),
  tiger: require('../../../../../assets/wallet/avatar/Tiger.png'),
  wolf: require('../../../../../assets/wallet/avatar/Wolf.png'),
};
export const HdWalletAvatarImageNames = Object.keys(HdWalletAvatarImages);
export const HwWalletAvatarImages = {
  classic: require('../../../../../assets/wallet/avatar/Classic.png'),
  mini: require('../../../../../assets/wallet/avatar/Mini.png'),
  touch: require('../../../../../assets/wallet/avatar/Touch.png'),
  pro: require('../../../../../assets/wallet/avatar/Pro.png'),
};
export const WalletAvatarImages = {
  cardDividers: require('../../../../../assets/wallet/avatar/CardDividers.png'),
  ...HdWalletAvatarImages,
  ...HwWalletAvatarImages,
};

export type IWalletAvatarImageNames = keyof typeof WalletAvatarImages;
export type IHdWalletAvatarImageNames = keyof typeof HdWalletAvatarImages;
export type IHwWalletAvatarImageNames = keyof typeof HwWalletAvatarImages;

export interface IWalletAvatarProps {
  status?: IWalletProps['status'];
  size?: SizeTokens;
  img?: IWalletAvatarImageNames;
  wallet: IDBWallet | undefined;
}

export function WalletAvatar({
  status,
  size = '$10',
  wallet,
  img,
}: IWalletAvatarProps) {
  // eslint-disable-next-line no-param-reassign
  img = img || wallet?.avatarInfo?.img;
  return (
    <Stack w={size} h={size} justifyContent="center" alignItems="center">
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
            source={WalletAvatarImages[img] ?? WalletAvatarImages.bear}
          />
        ) : (
          <Text>{wallet?.avatarInfo?.emoji ?? '😀'}</Text>
        )}
      </Avatar>
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
