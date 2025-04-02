export const blockChains = {
  sui: {
    name: 'Sui',
    networkId: 'sui--mainnet',
    assets: {
      '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN':
        {
          name: 'Bridged USDC',
          symbol: 'wUSDC',
          decimals: 6,
        },
      '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC':
        {
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
        },
    },
  },
};
