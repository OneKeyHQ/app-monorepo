import { Avatar, Skeleton, Stack } from '@onekeyhq/components';
import BearImg from '@onekeyhq/kit/assets/wallet/avatar/Bear.png';
import CardDividersImg from '@onekeyhq/kit/assets/wallet/avatar/CardDividers.png';
import CatImg from '@onekeyhq/kit/assets/wallet/avatar/Cat.png';
import ClassicImg from '@onekeyhq/kit/assets/wallet/avatar/classic.png';
import CowImg from '@onekeyhq/kit/assets/wallet/avatar/Cow.png';
import DogImg from '@onekeyhq/kit/assets/wallet/avatar/Dog.png';
import FoxImg from '@onekeyhq/kit/assets/wallet/avatar/Fox.png';
import FrogImg from '@onekeyhq/kit/assets/wallet/avatar/Frog.png';
import KoalaImg from '@onekeyhq/kit/assets/wallet/avatar/Koala.png';
import LionImg from '@onekeyhq/kit/assets/wallet/avatar/Lion.png';
import MiniImg from '@onekeyhq/kit/assets/wallet/avatar/mini.png';
import MonkeyImg from '@onekeyhq/kit/assets/wallet/avatar/Monkey.png';
import PandaImg from '@onekeyhq/kit/assets/wallet/avatar/Panda.png';
import PigImg from '@onekeyhq/kit/assets/wallet/avatar/Pig.png';
import PolarBearImg from '@onekeyhq/kit/assets/wallet/avatar/PolarBear.png';
import ProImg from '@onekeyhq/kit/assets/wallet/avatar/pro.png';
import RabbitImg from '@onekeyhq/kit/assets/wallet/avatar/Rabbit.png';
import RaccoonImg from '@onekeyhq/kit/assets/wallet/avatar/Raccoon.png';
import TigerImg from '@onekeyhq/kit/assets/wallet/avatar/Tiger.png';
import TouchImg from '@onekeyhq/kit/assets/wallet/avatar/touch.png';
import WolfImg from '@onekeyhq/kit/assets/wallet/avatar/Wolf.png';

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
  classic: ClassicImg,
  mini: MiniImg,
  touch: TouchImg,
  pro: ProImg,
  bear: BearImg,
  cardDividers: CardDividersImg,
  cat: CatImg,
  cow: CowImg,
  dog: DogImg,
  fox: FoxImg,
  frog: FrogImg,
  koala: KoalaImg,
  lion: LionImg,
  monkey: MonkeyImg,
  panda: PandaImg,
  pig: PigImg,
  polarBear: PolarBearImg,
  rabbit: RabbitImg,
  raccoon: RaccoonImg,
  tiger: TigerImg,
  wolf: WolfImg,
};

export function WalletAvatar({
  status,
  size = '$10',
  img,
}: IWalletAvatarProps) {
  return (
    <Stack w={size} h={size} justifyContent="center" alignItems="center">
      <Avatar size={size}>
        <Avatar.Image src={img ? WalletAvatarImages[img] : undefined} />
        <Avatar.Fallback>
          <Skeleton w={size} h={size} />
        </Avatar.Fallback>
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
