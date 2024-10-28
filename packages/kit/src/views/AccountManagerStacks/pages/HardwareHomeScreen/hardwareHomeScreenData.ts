import type { IImageSourcePropType } from '@onekeyhq/components/src/primitives/Image/type';

import classicMiniHomeScreenCustomHex from './classicMiniHomeScreenCustomHex';

export type IHardwareHomeScreenName =
  | 'blank'
  | 'original'
  | 'bitcoin_shade'
  | 'bitcoin_full'
  | 'ethereum'
  | 'bitcoin_b'
  | 'doge'
  | 'coffee'
  | 'carlos'
  | 'einstein'
  | 'anonymous'
  | 'piggy'
  | 'nyancat'
  | 'dogs'
  | 'tetris'
  | 'pacman'
  | 'tothemoon'
  | 'xrc'
  | 'wallpaper-1'
  | 'wallpaper-2'
  | 'wallpaper-3'
  | 'wallpaper-4'
  | 'wallpaper-5'
  | 'wallpaper-6'
  | 'wallpaper-7';

export type IHardwareHomeScreenData = {
  name: IHardwareHomeScreenName;
  source?: IImageSourcePropType; // image source by require('')
  uri?: string; // image base64 by upload & crop
  hex?: string; // image hex by resize
  thumbnailHex?: string; // thumb image hex by resize
  isUserUpload?: boolean;
};

export type IHardwareHomeScreenDataMap = Record<
  IHardwareHomeScreenName,
  IHardwareHomeScreenData
>;

const classicMini: IHardwareHomeScreenData[] = [
  {
    'name': 'blank',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/blank.png'),
  },
  {
    'name': 'original',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/original.png'),
  },
  {
    'name': 'bitcoin_shade',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_shade.png'),
  },
  {
    'name': 'bitcoin_full',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_full.png'),
  },
  {
    'name': 'ethereum',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/ethereum.png'),
  },
  {
    'name': 'bitcoin_b',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_b.png'),
  },
  {
    'name': 'doge',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/doge.png'),
  },
  {
    'name': 'coffee',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/coffee.png'),
  },
  {
    'name': 'carlos',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/carlos.png'),
  },
  {
    'name': 'einstein',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/einstein.png'),
  },
  {
    'name': 'anonymous',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/anonymous.png'),
  },
  {
    'name': 'piggy',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/piggy.png'),
  },
  {
    'name': 'nyancat',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/nyancat.png'),
  },
  {
    'name': 'dogs',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dogs.png'),
  },
  {
    'name': 'tetris',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/tetris.png'),
  },
  {
    'name': 'pacman',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/pacman.png'),
  },
  {
    'name': 'tothemoon',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/tothemoon.png'),
  },
  {
    'name': 'xrc',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/xrc.png'),
  },
];

const touch: IHardwareHomeScreenData[] = [
  {
    'name': 'wallpaper-1',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-1.jpg'),
  },
  {
    'name': 'wallpaper-2',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-2.jpg'),
  },
  {
    'name': 'wallpaper-3',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-3.jpg'),
  },
  {
    'name': 'wallpaper-4',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-4.jpg'),
  },
];

const pro: IHardwareHomeScreenData[] = [
  {
    'name': 'wallpaper-1',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-1.jpg'),
  },
  {
    'name': 'wallpaper-2',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-2.jpg'),
  },
  {
    'name': 'wallpaper-3',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-3.jpg'),
  },
  {
    'name': 'wallpaper-4',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-4.jpg'),
  },
  {
    'name': 'wallpaper-5',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-5.jpg'),
  },
  {
    'name': 'wallpaper-6',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-6.jpg'),
  },
  {
    'name': 'wallpaper-7',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-7.jpg'),
  },
];

export default {
  classicMini,
  classicMiniHomeScreenCustomHex,
  touch,
  pro,
};
