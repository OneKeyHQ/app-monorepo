import { Image } from 'react-native';

import { Avatar, Stack } from '@onekeyhq/components';

import type { IWalletProps } from '../../types';
import type { SizeTokens } from 'tamagui';

export interface IWalletAvatarProps {
  status?: IWalletProps['status'];
  size?: SizeTokens;
  img?:
    | 'classic'
    | 'mini'
    | 'touch'
    | 'pro'
    | 'bear'
    | 'cardDividers'
    | 'cat'
    | 'cow'
    | 'dog'
    | 'fox'
    | 'frog'
    | 'koala'
    | 'lion'
    | 'monkey'
    | 'panda'
    | 'pig'
    | 'polarBear'
    | 'rabbit'
    | 'raccoon'
    | 'tiger'
    | 'wolf';
}

export const WalletAvatarImages = {
  classic: require('../../../../../assets/wallet/avatar/Classic.png'),
  mini: require('../../../../../assets/wallet/avatar/Mini.png'),
  touch: require('../../../../../assets/wallet/avatar/Touch.png'),
  pro: require('../../../../../assets/wallet/avatar/Pro.png'),
  bear: require('../../../../../assets/wallet/avatar/Bear.png'),
  cardDividers: require('../../../../../assets/wallet/avatar/CardDividers.png'),
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

export function WalletAvatar({
  status,
  size = '$10',
  img,
}: IWalletAvatarProps) {
  if (!img) {
    return null;
  }
  return (
    <Stack w={size} h={size} justifyContent="center" alignItems="center">
      <Avatar size={size}>
        <Image
          // flex={1}
          width={40}
          height={20}
          style={{
            width: 40,
            height: 40,
          }}
          source={WalletAvatarImages[img]}
        />
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
