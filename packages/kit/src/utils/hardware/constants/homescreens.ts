import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { T1Data } from './homescreensData';

/**
 * For major_version less then 2.0.0
 */
export const homescreensT1 = [
  'default',
  'original',
  'circleweb',
  'circuit',
  'starweb',
  'stars',
  'bitcoin_b2',
  'bitcoin_shade',
  'bitcoin_b',
  'bitcoin_full',
  'bitcat',
  'nyancat',
  'coffee',
  'flower',
  'saturn',
  'jupiter',
  'einstein',
  'piggy',
  'honeybadger',
  'dragon',
  'narwal',
  'rabbit',
  'bunny',
  'rooster',
  'genesis',
  'my_bank',
  'candle',
  'ancap',
  'anonymous',
  'mushroom',
  'invader',
  'mtgox',
  'electrum',
  'mycelium',
  'ethereum',
  'litecoin',
  'myetherwallet',
  'zcash',
  'dash',
  'bitcoin_cash',
  'bitcoin_gold',
  'vertcoin',
  'namecoin',
  'monacoin',
  'doge',
  'digibyte',
  'decred',
  'multibit',
  'reddit',
  'hacker',
  'polis',
  'carlos',
  'xrc',
];

export const getHomescreenKeys = (type: IOneKeyDeviceType) => {
  switch (type) {
    case 'classic':
    case 'mini':
      return homescreensT1;
    default:
      return [];
  }
};

export type HomescreenItem = { name: string; staticPath: any; hex: string };

export type HomescreenMap = Record<string, HomescreenItem>;

export const getHomescreenData = (type: IOneKeyDeviceType) => {
  switch (type) {
    case 'classic':
    case 'mini':
      return getHomescreenKeys(type).reduce<HomescreenMap>(
        (acc, key: string) => {
          acc[key] = (T1Data as HomescreenMap)[key];
          return acc;
        },
        {} as HomescreenMap,
      );

    default:
      return {};
  }
};
