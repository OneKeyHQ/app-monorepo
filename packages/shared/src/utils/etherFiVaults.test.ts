import {
  EthereumUSDC,
  EthereumUSDT,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';

import { isAllowedEtherFiAsset } from './etherFiVaults';

const ethVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const usdVault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
const weth = {
  address: EthereumWETH,
  symbol: 'WETH',
  decimals: 18,
  isNative: false,
};

describe('EtherFi asset identity', () => {
  it('requires the canonical network, vault, address, symbol and precision', () => {
    const request = {
      vault: ethVault,
      networkId: 'evm--1',
      direction: 'stake' as const,
      token: weth,
    };
    expect(isAllowedEtherFiAsset(request)).toBe(true);
    expect(isAllowedEtherFiAsset({ ...request, networkId: 'evm--10' })).toBe(
      false,
    );
    expect(isAllowedEtherFiAsset({ ...request, vault: usdVault })).toBe(false);
    expect(
      isAllowedEtherFiAsset({
        ...request,
        token: { ...weth, address: EthereumUSDC },
      }),
    ).toBe(false);
    expect(
      isAllowedEtherFiAsset({ ...request, token: { ...weth, decimals: 6 } }),
    ).toBe(false);
    expect(
      isAllowedEtherFiAsset({ ...request, token: { ...weth, symbol: 'ETH' } }),
    ).toBe(false);
  });

  it('allows only the vault output assets for withdrawals', () => {
    const token = { address: EthereumUSDT, symbol: 'USDT', decimals: 6 };
    expect(
      isAllowedEtherFiAsset({
        vault: usdVault,
        networkId: 'evm--1',
        direction: 'unstake',
        token,
      }),
    ).toBe(true);
    expect(
      isAllowedEtherFiAsset({
        vault: ethVault,
        networkId: 'evm--1',
        direction: 'unstake',
        token,
      }),
    ).toBe(false);
  });
});
