import type { IImageSourcePropType } from '@onekeyhq/components/src/primitives/Image/type';

export type IHardwareHomeScreenData = {
  name: string;
  source?: IImageSourcePropType;
  uri?: string;
  hex?: string;
  thumbnailHex?: string;
  isUserUpload?: boolean;
};

export type IHardwareHomeScreenDataMap = {
  [name: string]: IHardwareHomeScreenData;
};

const classicMini: IHardwareHomeScreenData[] = [
  {
    'name': 'default',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/blank.png'),
  },
  {
    'name': 'original',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/original.png'),
  },
  {
    'name': 'circleweb',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/circleweb.png'),
  },
  {
    'name': 'circuit',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/circuit.png'),
  },
  {
    'name': 'starweb',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/starweb.png'),
  },
  {
    'name': 'stars',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/stars.png'),
  },
  {
    'name': 'bitcoin_b2',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_b2.png'),
  },
  {
    'name': 'bitcoin_shade',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_shade.png'),
  },
  {
    'name': 'bitcoin_b',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_b.png'),
  },
  {
    'name': 'bitcoin_full',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_full.png'),
  },
  {
    'name': 'bitcat',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcat.png'),
  },
  {
    'name': 'nyancat',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/nyancat.png'),
  },
  {
    'name': 'coffee',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/coffee.png'),
  },
  {
    'name': 'flower',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/flower.png'),
  },
  {
    'name': 'saturn',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/saturn.png'),
  },
  {
    'name': 'jupiter',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/jupiter.png'),
  },
  {
    'name': 'einstein',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/einstein.png'),
  },
  {
    'name': 'piggy',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/piggy.png'),
  },
  {
    'name': 'honeybadger',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/honeybadger.png'),
  },
  {
    'name': 'dragon',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dragon.png'),
  },
  {
    'name': 'narwal',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/narwal.png'),
  },
  {
    'name': 'rabbit',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/rabbit.png'),
  },
  {
    'name': 'bunny',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bunny.png'),
  },
  {
    'name': 'rooster',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/rooster.png'),
  },
  {
    'name': 'genesis',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/genesis.png'),
  },
  {
    'name': 'my_bank',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/my_bank.png'),
  },
  {
    'name': 'candle',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/candle.png'),
  },
  {
    'name': 'ancap',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/ancap.png'),
  },
  {
    'name': 'anonymous',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/anonymous.png'),
  },
  {
    'name': 'mushroom',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/mushroom.png'),
  },
  {
    'name': 'invader',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/invader.png'),
  },
  {
    'name': 'mtgox',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/mtgox.png'),
  },
  {
    'name': 'electrum',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/electrum.png'),
  },
  {
    'name': 'mycelium',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/mycelium.png'),
  },
  {
    'name': 'ethereum',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/ethereum.png'),
  },
  {
    'name': 'litecoin',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/litecoin.png'),
  },
  {
    'name': 'myetherwallet',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/myetherwallet.png'),
  },
  {
    'name': 'zcash',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/zcash.png'),
  },
  {
    'name': 'dash',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/dash.png'),
  },
  {
    'name': 'bitcoin_cash',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_cash.png'),
  },
  {
    'name': 'bitcoin_gold',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/bitcoin_gold.png'),
  },
  {
    'name': 'vertcoin',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/vertcoin.png'),
  },
  {
    'name': 'namecoin',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/namecoin.png'),
  },
  {
    'name': 'monacoin',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/monacoin.png'),
  },
  {
    'name': 'doge',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/doge.png'),
  },
  {
    'name': 'digibyte',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/digibyte.png'),
  },
  {
    'name': 'decred',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/decred.png'),
  },
  {
    'name': 'multibit',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/multibit.png'),
  },
  {
    'name': 'reddit',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/reddit.png'),
  },
  {
    'name': 'hacker',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/hacker.png'),
  },
  {
    'name': 'polis',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/polis.png'),
  },
  {
    'name': 'carlos',
    'source': require('@onekeyhq/shared/src/assets/hardware/homescreens/t1/carlos.png'),
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
  touch,
  pro,
};
