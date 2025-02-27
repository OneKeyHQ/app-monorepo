import type { ImageURISource } from 'react-native';

const CowswapLogo = require('@onekeyhq/shared/src/assets/browser/Cowswap.png');
const EthenaLogo = require('@onekeyhq/shared/src/assets/browser/Ethena.png');
const MorphoLogo = require('@onekeyhq/shared/src/assets/browser/Morpho.png');
const PendleLogo = require('@onekeyhq/shared/src/assets/browser/Pendle.png');
const SkyLogo = require('@onekeyhq/shared/src/assets/browser/Sky.png');
const UniswapLogo = require('@onekeyhq/shared/src/assets/browser/Uniswap.png');

export interface IBrowserWelcomeLogo {
  name: string;
  url: string;
  icon: ImageURISource | ImageURISource['uri'];
}

export type IBrowserWelcomeLogos = {
  [key: string]: IBrowserWelcomeLogo;
};

export const browserWelcomeLogos: IBrowserWelcomeLogos = {
  uniswap: {
    name: 'Uniswap',
    url: 'https://uniswap.org/',
    icon: UniswapLogo,
  },
  cowswap: {
    name: 'Cowswap',
    url: 'https://cow.fi/',
    icon: CowswapLogo,
  },
  pendle: {
    name: 'Pendle',
    url: 'https://www.pendle.finance/',
    icon: PendleLogo,
  },
  morpho: {
    name: 'Morpho',
    url: 'https://www.morpho.xyz/',
    icon: MorphoLogo,
  },
  sky: {
    name: 'Sky',
    url: 'https://sky.money/',
    icon: SkyLogo,
  },
  ethena: {
    name: 'Ethena',
    url: 'https://ethena.io/',
    icon: EthenaLogo,
  },
};
