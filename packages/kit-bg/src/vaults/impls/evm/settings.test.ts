import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumUSDC,
  EthereumUSDT,
} from '@onekeyhq/shared/src/consts/addresses';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import settings from './settings';

describe('EVM Spark Earn settings', () => {
  it('enables Spark Savings for Ethereum USDC and USDT', () => {
    const sparkConfig =
      settings.stakingConfig?.[getNetworkIdsMap().eth]?.providers[
        EEarnProviderEnum.Spark
      ];

    expect(sparkConfig).toEqual({
      supportedSymbols: ['USDC', 'USDT'],
      configs: {
        USDC: {
          enabled: true,
          tokenAddress: EthereumUSDC,
          displayProfit: true,
          stakingWithApprove: true,
        },
        USDT: {
          enabled: true,
          tokenAddress: EthereumUSDT,
          displayProfit: true,
          stakingWithApprove: true,
        },
      },
    });
  });
});
