import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ROBINHOOD_NETWORK_ID } from '@onekeyhq/shared/src/config/presetNetworks';
import type {
  IPoolAssetCategory,
  IPoolHook,
  IPoolProtocolVersion,
} from '@onekeyhq/shared/types/pools';

// Demo snapshot for the Pools prototype; no indexer behind it yet. Token
// addresses and logos are real. Prices were taken on 2026-10-19: stocks from
// Robinhood's /rhj/prices mid quote times the token's current multiplier
// (on-chain tokens price the multiplier in), crypto from CoinGecko (BNB, ARB
// and LINK on 2026-10-20). Pool metrics are invented but sized like real
// pools of the same pair.

export const POOLS_ETHEREUM_NETWORK_ID = getNetworkIdsMap().eth;
export const POOLS_BASE_NETWORK_ID = getNetworkIdsMap().base;
export const POOLS_ROBINHOOD_NETWORK_ID = ROBINHOOD_NETWORK_ID;
export const POOLS_BSC_NETWORK_ID = getNetworkIdsMap().bsc;
export const POOLS_ARBITRUM_NETWORK_ID = getNetworkIdsMap().arbitrum;
// A preset network the short-code map does not name
export const POOLS_UNICHAIN_NETWORK_ID = 'evm--130';

export const POOLS_NETWORK_IDS = [
  POOLS_ROBINHOOD_NETWORK_ID,
  POOLS_ETHEREUM_NETWORK_ID,
  POOLS_BASE_NETWORK_ID,
  POOLS_BSC_NETWORK_ID,
  POOLS_ARBITRUM_NETWORK_ID,
  POOLS_UNICHAIN_NETWORK_ID,
];

export type IPoolsAssetSeed = {
  symbol: string;
  name: string;
  /** Empty for the chain's native coin */
  address: string;
  decimals: number;
  priceUsd: number;
  logoURI: string;
  /** Assets sharing a canonical id count as one (ETH and WETH) */
  canonical?: string;
  category?: IPoolAssetCategory;
  issuer?: string;
  /** No price but the one its own pools imply */
  untrustedPrice?: boolean;
};

const ETH_LOGO = 'https://uni.onekey-asset.com/static/chain/eth.png';
const WETH_LOGO = 'https://uni.onekey-asset.com/static/logo/WETH.png';
const ETH_PRICE = 2430.83;
const BTC_PRICE = 82_783;
const BNB_PRICE = 728.16;
const BNB_LOGO = 'https://uni.onekey-asset.com/static/chain/bsc.png';

function onchainLogo(networkId: string, address: string) {
  return `https://uni.onekey-asset.com/server-service-onchain/${networkId}/tokens/${address.toLowerCase()}.png`;
}

// Robinhood's own CDN serves one generic image for every stock token, so
// the logos come from OneKey's stock set, as on the Market tab
function stockLogo(symbol: string) {
  return `https://uni.onekey-asset.com/static/stock/${symbol}.png`;
}

function stockToken({
  symbol,
  name,
  address,
  quote,
  multiplier,
}: {
  symbol: string;
  name: string;
  address: string;
  quote: number;
  multiplier: number;
}): IPoolsAssetSeed {
  return {
    symbol,
    name,
    address,
    decimals: 18,
    priceUsd: Number((quote * multiplier).toFixed(2)),
    logoURI: stockLogo(symbol),
    category: 'stock',
    issuer: 'Robinhood',
  };
}

const USDG_ETHEREUM_ADDRESS = '0xe343167631d89B6Ffc58B88d6b7fB0228795491D';

export const POOLS_ASSET_SEEDS: Record<string, IPoolsAssetSeed[]> = {
  [POOLS_ETHEREUM_NETWORK_ID]: [
    {
      symbol: 'ETH',
      name: 'Ether',
      address: '',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: ETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: WETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      decimals: 8,
      priceUsd: BTC_PRICE,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      ),
      category: 'bluechip',
    },
    {
      // A days-old token with no price source but its own pool
      symbol: 'XMOON',
      name: 'XMoon',
      address: '0x7a1b9c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b',
      decimals: 18,
      priceUsd: 0.14,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0x7a1b9c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b',
      ),
      untrustedPrice: true,
    },
    {
      symbol: 'PEPE',
      name: 'Pepe',
      address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      decimals: 18,
      priceUsd: 0.000_004_09,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      ),
    },
    {
      symbol: 'LINK',
      name: 'Chainlink',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
      priceUsd: 12.19,
      logoURI: onchainLogo(
        POOLS_ETHEREUM_NETWORK_ID,
        '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      ),
    },
  ],
  [POOLS_BASE_NETWORK_ID]: [
    {
      symbol: 'ETH',
      name: 'Ether',
      address: '',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: ETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: WETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_BASE_NETWORK_ID,
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'cbBTC',
      name: 'Coinbase Wrapped BTC',
      address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      decimals: 8,
      priceUsd: BTC_PRICE,
      logoURI: onchainLogo(
        POOLS_BASE_NETWORK_ID,
        '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      ),
      category: 'bluechip',
    },
  ],
  [POOLS_ROBINHOOD_NETWORK_ID]: [
    {
      symbol: 'ETH',
      name: 'Ether',
      address: '',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: ETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: WETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'USDG',
      name: 'Global Dollar',
      address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(POOLS_ETHEREUM_NETWORK_ID, USDG_ETHEREUM_ADDRESS),
      category: 'stablecoin',
    },
    stockToken({
      symbol: 'TSLA',
      name: 'Tesla',
      address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
      quote: 357.4,
      multiplier: 1,
    }),
    stockToken({
      symbol: 'NVDA',
      name: 'NVIDIA',
      address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
      quote: 217.46,
      multiplier: 1.000_775,
    }),
    stockToken({
      symbol: 'AAPL',
      name: 'Apple',
      address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
      quote: 343.79,
      multiplier: 1.000_566,
    }),
    stockToken({
      symbol: 'AMZN',
      name: 'Amazon',
      address: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
      quote: 252.53,
      multiplier: 1,
    }),
    stockToken({
      symbol: 'MSFT',
      name: 'Microsoft',
      address: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
      quote: 533,
      multiplier: 1.000_412,
    }),
    stockToken({
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      address: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
      quote: 768.36,
      multiplier: 1.001_717,
    }),
  ],
  [POOLS_BSC_NETWORK_ID]: [
    {
      symbol: 'BNB',
      name: 'BNB',
      address: '',
      decimals: 18,
      priceUsd: BNB_PRICE,
      logoURI: BNB_LOGO,
      canonical: 'BNB',
      category: 'bluechip',
    },
    {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      priceUsd: BNB_PRICE,
      logoURI: onchainLogo(
        POOLS_BSC_NETWORK_ID,
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      ),
      canonical: 'BNB',
      category: 'bluechip',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_BSC_NETWORK_ID,
        '0x55d398326f99059fF775485246999027B3197955',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_BSC_NETWORK_ID,
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'BTCB',
      name: 'Binance-Peg BTCB',
      address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      decimals: 18,
      priceUsd: BTC_PRICE,
      logoURI: onchainLogo(
        POOLS_BSC_NETWORK_ID,
        '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      ),
      category: 'bluechip',
    },
  ],
  [POOLS_ARBITRUM_NETWORK_ID]: [
    {
      symbol: 'ETH',
      name: 'Ether',
      address: '',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: ETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: WETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_ARBITRUM_NETWORK_ID,
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      ),
      category: 'stablecoin',
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      decimals: 18,
      priceUsd: 0.1894,
      logoURI: onchainLogo(
        POOLS_ARBITRUM_NETWORK_ID,
        '0x912CE59144191C1204E64559FE8253a0e49E6548',
      ),
    },
  ],
  [POOLS_UNICHAIN_NETWORK_ID]: [
    {
      symbol: 'ETH',
      name: 'Ether',
      address: '',
      decimals: 18,
      priceUsd: ETH_PRICE,
      logoURI: ETH_LOGO,
      canonical: 'ETH',
      category: 'bluechip',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
      decimals: 6,
      priceUsd: 1,
      logoURI: onchainLogo(
        POOLS_UNICHAIN_NETWORK_ID,
        '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
      ),
      category: 'stablecoin',
    },
  ],
};

/** How liquidity spreads around the price in a pool's synthetic book */
export type IPoolsLiquidityShape = 'stable' | 'volatile' | 'stock';

export type IPoolsPoolSeed = {
  /** Stable short key; pool ids and the mock PoolId derive from it */
  key: string;
  networkId: string;
  version: IPoolProtocolVersion;
  symbols: [string, string];
  /** Hundredths of a bip; for dynamic pools the fee charged right now */
  feeTier: number;
  isDynamicFee?: boolean;
  hook?: Omit<IPoolHook, 'address'>;
  aprEstimateSupported?: boolean;
  /**
   * Both sides at the pool's own price. With a token that has no trusted
   * price this is the raw figure, and the list counts `trustedSideUsd`
   */
  tvlUsd: number;
  /** The side whose token has a trusted price, when the other has none */
  trustedSideUsd?: number;
  volume24hUsd: number;
  /** Defaults to volume × fee tier */
  fees24hUsd?: number;
  shape: IPoolsLiquidityShape;
  /** Days since the pool was created; a random older age when absent */
  ageDays?: number;
};

export const POOLS_POOL_SEEDS: IPoolsPoolSeed[] = [
  // Robinhood Chain
  {
    key: 'rh-v3-tsla-usdg-3000',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v3',
    symbols: ['TSLA', 'USDG'],
    feeTier: 3000,
    tvlUsd: 8_412_300,
    volume24hUsd: 1_896_400,
    shape: 'stock',
  },
  {
    key: 'rh-v3-nvda-usdg-3000',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v3',
    symbols: ['NVDA', 'USDG'],
    feeTier: 3000,
    tvlUsd: 6_203_800,
    volume24hUsd: 1_204_700,
    shape: 'stock',
  },
  {
    key: 'rh-v4-aapl-usdg-3000',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v4',
    symbols: ['AAPL', 'USDG'],
    feeTier: 3000,
    tvlUsd: 3_706_500,
    volume24hUsd: 698_300,
    shape: 'stock',
  },
  {
    key: 'rh-v4-spy-usdg-hook',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v4',
    symbols: ['SPY', 'USDG'],
    feeTier: 500,
    isDynamicFee: true,
    hook: {
      name: 'Market hours fee',
      description:
        'Charges a higher LP fee while the US stock market is closed, when the on-chain price can drift from the last close. All fees still go to LPs.',
    },
    tvlUsd: 5_391_200,
    volume24hUsd: 4_806_400,
    fees24hUsd: 3104.7,
    shape: 'stock',
  },
  {
    key: 'rh-v3-amzn-usdg-3000',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v3',
    symbols: ['AMZN', 'USDG'],
    feeTier: 3000,
    tvlUsd: 2_108_400,
    volume24hUsd: 309_800,
    shape: 'stock',
    ageDays: 6,
  },
  {
    key: 'rh-v3-msft-usdg-3000',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v3',
    symbols: ['MSFT', 'USDG'],
    feeTier: 3000,
    tvlUsd: 1_874_900,
    volume24hUsd: 258_600,
    shape: 'stock',
    ageDays: 11,
  },
  {
    key: 'rh-v2-tsla-usdg',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v2',
    symbols: ['TSLA', 'USDG'],
    feeTier: 3000,
    tvlUsd: 1_596_100,
    volume24hUsd: 209_500,
    shape: 'stock',
  },
  {
    key: 'rh-v3-weth-usdg-500',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'USDG'],
    feeTier: 500,
    tvlUsd: 14_617_500,
    volume24hUsd: 19_203_800,
    shape: 'volatile',
  },
  {
    key: 'rh-v4-eth-usdg-500',
    networkId: POOLS_ROBINHOOD_NETWORK_ID,
    version: 'v4',
    symbols: ['ETH', 'USDG'],
    feeTier: 500,
    tvlUsd: 4_902_600,
    volume24hUsd: 6_311_400,
    shape: 'volatile',
  },
  // Ethereum
  {
    key: 'eth-v3-usdc-weth-500',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'USDC'],
    feeTier: 500,
    tvlUsd: 128_402_700,
    volume24hUsd: 241_605_300,
    shape: 'volatile',
  },
  {
    key: 'eth-v4-eth-usdc-500',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v4',
    symbols: ['ETH', 'USDC'],
    feeTier: 500,
    tvlUsd: 61_309_400,
    volume24hUsd: 88_210_900,
    shape: 'volatile',
  },
  {
    key: 'eth-v3-usdc-weth-3000',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'USDC'],
    feeTier: 3000,
    tvlUsd: 52_705_100,
    volume24hUsd: 8_904_600,
    shape: 'volatile',
  },
  {
    key: 'eth-v2-usdc-weth',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v2',
    symbols: ['WETH', 'USDC'],
    feeTier: 3000,
    tvlUsd: 27_890_600,
    volume24hUsd: 3_602_300,
    shape: 'volatile',
  },
  {
    key: 'eth-v3-wbtc-weth-500',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['WBTC', 'WETH'],
    feeTier: 500,
    tvlUsd: 84_613_800,
    volume24hUsd: 27_412_500,
    shape: 'volatile',
  },
  {
    key: 'eth-v3-usdc-usdt-100',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['USDC', 'USDT'],
    feeTier: 100,
    tvlUsd: 43_208_200,
    volume24hUsd: 61_507_900,
    shape: 'stable',
  },
  {
    key: 'eth-v4-usdc-usdt-100',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v4',
    symbols: ['USDC', 'USDT'],
    feeTier: 100,
    tvlUsd: 12_406_900,
    volume24hUsd: 18_934_200,
    shape: 'stable',
  },
  {
    key: 'eth-v3-pepe-weth-10000',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['PEPE', 'WETH'],
    feeTier: 10_000,
    tvlUsd: 9_806_300,
    volume24hUsd: 2_104_800,
    shape: 'volatile',
  },
  {
    // Its own side claims $3.4B at the pool's price; the list counts twice
    // the $5,200 of WETH beside it, so it ranks last instead of first
    key: 'eth-v3-xmoon-weth-500',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['XMOON', 'WETH'],
    feeTier: 500,
    tvlUsd: 3_428_000_000,
    trustedSideUsd: 5200,
    volume24hUsd: 400,
    shape: 'volatile',
    ageDays: 3,
  },
  {
    // Under the list's volume floor: found by its address only, and adding
    // to it asks the user to accept the risk first
    key: 'eth-v3-link-weth-10000',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['LINK', 'WETH'],
    feeTier: 10_000,
    tvlUsd: 18_400,
    volume24hUsd: 62,
    shape: 'volatile',
  },
  {
    key: 'eth-v3-pepe-weth-3000',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['PEPE', 'WETH'],
    feeTier: 3000,
    tvlUsd: 28_640_500,
    volume24hUsd: 9_871_300,
    shape: 'volatile',
  },
  {
    key: 'eth-v3-link-weth-3000',
    networkId: POOLS_ETHEREUM_NETWORK_ID,
    version: 'v3',
    symbols: ['LINK', 'WETH'],
    feeTier: 3000,
    tvlUsd: 14_823_900,
    volume24hUsd: 2_310_600,
    shape: 'volatile',
  },
  // Base
  {
    key: 'base-v3-weth-usdc-500',
    networkId: POOLS_BASE_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'USDC'],
    feeTier: 500,
    tvlUsd: 36_205_400,
    volume24hUsd: 58_102_600,
    shape: 'volatile',
  },
  {
    key: 'base-v4-eth-usdc-hook-dynamic',
    networkId: POOLS_BASE_NETWORK_ID,
    version: 'v4',
    symbols: ['ETH', 'USDC'],
    feeTier: 500,
    isDynamicFee: true,
    hook: {
      name: 'Volatility fee',
      description:
        'Raises the LP fee when the price moves fast and lowers it when the market is calm. All fees still go to LPs.',
    },
    tvlUsd: 11_804_200,
    volume24hUsd: 38_407_100,
    fees24hUsd: 9812.4,
    shape: 'volatile',
  },
  {
    key: 'base-v3-weth-cbbtc-500',
    networkId: POOLS_BASE_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'cbBTC'],
    feeTier: 500,
    tvlUsd: 21_403_900,
    volume24hUsd: 16_805_200,
    shape: 'volatile',
  },
  {
    key: 'base-v2-weth-usdc',
    networkId: POOLS_BASE_NETWORK_ID,
    version: 'v2',
    symbols: ['WETH', 'USDC'],
    feeTier: 3000,
    tvlUsd: 5_906_700,
    volume24hUsd: 1_103_400,
    shape: 'volatile',
  },
  {
    key: 'base-v4-eth-usdc-hook-rebate',
    networkId: POOLS_BASE_NETWORK_ID,
    version: 'v4',
    symbols: ['ETH', 'USDC'],
    feeTier: 3000,
    hook: {
      name: 'Trader rebate',
      description:
        'Pays part of every swap fee back to the trader, so LPs keep less than the fee rate shown. The range estimate cannot model it yet.',
    },
    aprEstimateSupported: false,
    tvlUsd: 2_604_800,
    volume24hUsd: 906_300,
    fees24hUsd: 1903.2,
    shape: 'volatile',
    ageDays: 3,
  },
  // BNB Chain
  {
    key: 'bsc-v3-wbnb-usdt-500',
    networkId: POOLS_BSC_NETWORK_ID,
    version: 'v3',
    symbols: ['WBNB', 'USDT'],
    feeTier: 500,
    tvlUsd: 41_822_600,
    volume24hUsd: 25_934_100,
    shape: 'volatile',
  },
  {
    key: 'bsc-v3-usdt-usdc-100',
    networkId: POOLS_BSC_NETWORK_ID,
    version: 'v3',
    symbols: ['USDT', 'USDC'],
    feeTier: 100,
    tvlUsd: 22_641_300,
    volume24hUsd: 37_208_500,
    shape: 'stable',
  },
  {
    key: 'bsc-v3-btcb-wbnb-500',
    networkId: POOLS_BSC_NETWORK_ID,
    version: 'v3',
    symbols: ['BTCB', 'WBNB'],
    feeTier: 500,
    tvlUsd: 18_352_700,
    volume24hUsd: 11_402_900,
    shape: 'volatile',
  },
  {
    key: 'bsc-v4-bnb-usdt-500',
    networkId: POOLS_BSC_NETWORK_ID,
    version: 'v4',
    symbols: ['BNB', 'USDT'],
    feeTier: 500,
    tvlUsd: 9_708_400,
    volume24hUsd: 14_583_600,
    shape: 'volatile',
  },
  // Arbitrum
  {
    key: 'arb-v3-weth-usdc-500',
    networkId: POOLS_ARBITRUM_NETWORK_ID,
    version: 'v3',
    symbols: ['WETH', 'USDC'],
    feeTier: 500,
    tvlUsd: 47_304_800,
    volume24hUsd: 29_331_200,
    shape: 'volatile',
  },
  {
    key: 'arb-v3-arb-weth-3000',
    networkId: POOLS_ARBITRUM_NETWORK_ID,
    version: 'v3',
    symbols: ['ARB', 'WETH'],
    feeTier: 3000,
    tvlUsd: 7_921_500,
    volume24hUsd: 1_395_200,
    shape: 'volatile',
  },
  // Unichain
  {
    key: 'uni-v4-eth-usdc-500',
    networkId: POOLS_UNICHAIN_NETWORK_ID,
    version: 'v4',
    symbols: ['ETH', 'USDC'],
    feeTier: 500,
    tvlUsd: 11_263_900,
    volume24hUsd: 19_254_700,
    shape: 'volatile',
  },
];

export type IPoolsPositionSeed = {
  poolKey: string;
  /** Range as offsets from the current price, e.g. [-0.12, 0.12] */
  rangePercent?: [number, number];
  /** Position value; zero for a closed position */
  valueUsd: number;
  /** Unclaimed fees, split evenly by value between the two tokens */
  feesUsd: number;
  daysAgo: number;
  tokenId?: string;
};

export const POOLS_POSITION_SEEDS: IPoolsPositionSeed[] = [
  {
    poolKey: 'eth-v3-usdc-weth-500',
    rangePercent: [-0.12, 0.12],
    valueUsd: 8210.4,
    feesUsd: 46.18,
    daysAgo: 23,
    tokenId: '1042871',
  },
  {
    // The price climbed above this range; the position is all USDG now
    poolKey: 'rh-v3-tsla-usdg-3000',
    rangePercent: [-0.18, -0.06],
    valueUsd: 3120.02,
    feesUsd: 12.4,
    daysAgo: 41,
    tokenId: '20915',
  },
  {
    poolKey: 'base-v4-eth-usdc-hook-dynamic',
    rangePercent: [-0.15, 0.15],
    valueUsd: 2451.9,
    feesUsd: 8.92,
    daysAgo: 12,
    tokenId: '88413',
  },
  {
    poolKey: 'rh-v3-nvda-usdg-3000',
    rangePercent: [-0.04, 0.2],
    valueUsd: 1890.33,
    feesUsd: 6.71,
    daysAgo: 9,
    tokenId: '21388',
  },
  {
    poolKey: 'base-v2-weth-usdc',
    valueUsd: 1149.8,
    feesUsd: 0,
    daysAgo: 64,
  },
  {
    poolKey: 'eth-v3-link-weth-10000',
    rangePercent: [-0.3, 0.3],
    valueUsd: 420.55,
    feesUsd: 5.1,
    daysAgo: 120,
    tokenId: '988230',
  },
  {
    // Closed, but unclaimed fees remain, so it must stay visible
    poolKey: 'eth-v3-usdc-usdt-100',
    rangePercent: [-0.002, 0.002],
    valueUsd: 0,
    feesUsd: 3.21,
    daysAgo: 88,
    tokenId: '1019255',
  },
];

/** Wallet balances the demo starts with, by network and symbol */
export const POOLS_BALANCE_SEEDS: Record<string, Record<string, number>> = {
  [POOLS_ROBINHOOD_NETWORK_ID]: {
    ETH: 0.64,
    USDG: 9610.4,
    TSLA: 6.2,
    NVDA: 14.5,
    AAPL: 3.1,
  },
  [POOLS_ETHEREUM_NETWORK_ID]: {
    ETH: 1.85,
    WETH: 0.42,
    USDC: 12_450,
    USDT: 3200,
    WBTC: 0.081,
  },
  [POOLS_BASE_NETWORK_ID]: {
    ETH: 0.96,
    WETH: 0.15,
    USDC: 4820.55,
    cbBTC: 0.0213,
  },
  [POOLS_BSC_NETWORK_ID]: {
    BNB: 1.24,
    USDT: 2560.8,
    BTCB: 0.012,
  },
  [POOLS_ARBITRUM_NETWORK_ID]: {
    ETH: 0.35,
    USDC: 1804.2,
    ARB: 950,
  },
  [POOLS_UNICHAIN_NETWORK_ID]: {
    ETH: 0.21,
    USDC: 512.4,
  },
};
