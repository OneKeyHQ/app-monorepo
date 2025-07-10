import type { IImageProps } from '@onekeyhq/components/src/primitives/Image/type';

import classicMiniHomeScreenCustomHex from './classicMiniHomeScreenCustomHex';

export type IHardwareHomeScreenName =
  | 'onekey_logo'
  | 'onekey'
  | 'hyok'
  | 'piza'
  | 'moon'
  | 'cattle'
  | 'mushroom'
  | 'solana'
  | 'mapleleaf'
  | 'pp'
  | 'wojar'
  | 'wojar_m'
  | 'binance'
  | 'okx'
  | 'bitget'
  | 'bybit'
  | 'kaspa'
  | 'okcoin'
  | 'htx'
  | 'babylon'
  | 'star'
  | 'nervos'
  | 'xphere'
  | 'benmo'
  | 'alephium'
  | 'bingx'
  | 'dodochain'
  | 'dnx'
  | 'pumpspace'
  | 'passto'
  | 'spaceid'
  | 'benfen'
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
  source?: IImageProps['source']; // image source by require('')
  uri?: string; // image base64 by upload & crop
  hex?: string; // image hex by resize
  thumbnailHex?: string; // thumb image hex by resize
  isUserUpload?: boolean;
  wallpaperType?: 'default' | 'cobranding';
};

export type IHardwareHomeScreenDataWithId = IHardwareHomeScreenData & {
  id: string;
};

export type IHardwareHomeScreenDataMap = Record<
  IHardwareHomeScreenName,
  IHardwareHomeScreenData
>;

const classic1s: IHardwareHomeScreenData[] = [
  {
    'name': 'onekey_logo',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/onekey_logo.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'original',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/original.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'onekey',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/onekey.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'hyok',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/hyok.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'piza',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/piza.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'moon',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/moon.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'cattle',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/cattle.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'mushroom',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/mushroom.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'bitcoin_b',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_b.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'ethereum',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/ethereum.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'solana',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/solana.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'mapleleaf',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/mapleleaf.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'pp',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/pp.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wojar',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/wojar.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wojar_m',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/wojar_m.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'doge',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/doge.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'binance',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/binance.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'okx',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/okx.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'bitget',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitget.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'bybit',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bybit.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'kaspa',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/kaspa.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'okcoin',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/okcoin.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'htx',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/htx.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'babylon',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/babylon.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'star',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/star.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'nervos',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/nervos.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'xphere',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/xphere.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'benmo',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/benmo.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'alephium',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/alephium.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'bingx',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bingx.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'dodochain',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dodochain.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'dnx',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dnx.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'pumpspace',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/pumpspace.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'passto',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/passto.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'spaceid',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/spaceid.png'),
    'wallpaperType': 'cobranding',
  },
  {
    'name': 'benfen',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/benfen.png'),
    'wallpaperType': 'cobranding',
  },
];

const classicMini: IHardwareHomeScreenData[] = [
  {
    'name': 'blank',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/blank.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'original',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/original.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'bitcoin_shade',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_shade.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'bitcoin_full',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_full.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'ethereum',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/ethereum.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'bitcoin_b',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_b.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'doge',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/doge.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'coffee',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/coffee.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'carlos',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/carlos.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'einstein',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/einstein.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'anonymous',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/anonymous.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'piggy',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/piggy.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'nyancat',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/nyancat.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'dogs',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dogs.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'tetris',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/tetris.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'pacman',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/pacman.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'tothemoon',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/tothemoon.png'),
    'wallpaperType': 'default',
  },
  {
    'name': 'xrc',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/xrc.png'),
    'wallpaperType': 'default',
  },
];

const touch: IHardwareHomeScreenData[] = [
  {
    'name': 'wallpaper-1',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-1.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-2',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-2.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-3',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-3.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-4',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/touch/zoom-wallpaper-4.jpg'),
    'wallpaperType': 'default',
  },
];

const pro: IHardwareHomeScreenData[] = [
  {
    'name': 'wallpaper-1',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-1.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-2',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-2.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-3',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-3.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-4',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-4.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-5',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-5.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-6',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-6.jpg'),
    'wallpaperType': 'default',
  },
  {
    'name': 'wallpaper-7',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/pro/wallpaper-7.jpg'),
    'wallpaperType': 'default',
  },
];

export default {
  classic1s,
  classicMini,
  classicMiniHomeScreenCustomHex,
  touch,
  pro,
};
