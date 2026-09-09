import { getNetworkIdsMap } from '../../src/config/networkIds';
import { EthereumUSDC, KatanaVbUSDC } from '../../src/consts/addresses';
import { ESwapTabSwitchType } from '../swap/types';

import {
  getImportFromToken,
  isSupportStaking,
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from './earnProvider.constants';

describe('Bitway Earn provider constants', () => {
  it('normalizes the provider name used by Earn routes', () => {
    expect(normalizeToEarnProvider('bitway')).toBe('Bitway');
    expect(normalizeToEarnProvider('BITWAY')).toBe('Bitway');
  });

  it.each([
    ['u', 'U'],
    ['btw', 'BTW'],
  ])('normalizes the Bitway symbol %s to %s', (input, expected) => {
    expect(normalizeToEarnSymbol(input)).toBe(expected);
  });

  it.each(['U', 'BTW'])(
    'exposes the %s Market token as Earn-capable',
    (symbol) => {
      expect(isSupportStaking(symbol)).toBe(true);
    },
  );

  it('exposes the vbUSDC Market token as Earn-capable', () => {
    expect(normalizeToEarnSymbol('vbusdc')).toBe('vbUSDC');
    expect(isSupportStaking('vbUSDC')).toBe(true);
  });

  it('uses Ethereum USDC as the default funding token for Katana vbUSDC', () => {
    const { importFromToken, swapTabSwitchType } = getImportFromToken({
      networkId: getNetworkIdsMap().katana,
      tokenAddress: KatanaVbUSDC,
    });

    expect(importFromToken).toMatchObject({
      networkId: getNetworkIdsMap().eth,
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
    });
    expect(importFromToken?.contractAddress.toLowerCase()).toBe(
      EthereumUSDC.toLowerCase(),
    );
    expect(swapTabSwitchType).toBe(ESwapTabSwitchType.SWAP);
  });

  it('does not apply the vbUSDC default to other Katana tokens', () => {
    const { importFromToken } = getImportFromToken({
      networkId: getNetworkIdsMap().katana,
      tokenAddress: '0x0000000000000000000000000000000000000001',
    });

    expect(importFromToken).toBeUndefined();
  });
});
