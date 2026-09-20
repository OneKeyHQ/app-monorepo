import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import {
  hasMarketContractAddress,
  isMarketTokenDecimalsReady,
  isMatchingMarketTokenIdentity,
} from './marketTokenIdentity';

const btcNetworkId = getNetworkIdsMap().btc;
const solNetworkId = getNetworkIdsMap().sol;

describe('isMatchingMarketTokenIdentity', () => {
  it('matches when neither side has a contract address', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: '', networkId: btcNetworkId },
        { tokenAddress: 'bitcoin', networkId: btcNetworkId, isNative: false },
      ),
    ).toBe(true);
  });

  it('matches a native asset when only one side has a contract', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: '', networkId: btcNetworkId, isNative: true },
        {
          tokenAddress: '0x0000000000000000000000000000000000000000',
          networkId: btcNetworkId,
          isNative: false,
        },
      ),
    ).toBe(true);
  });

  it('does not match a native coin with a contract on the same network', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: '', networkId: solNetworkId, isNative: true },
        {
          tokenAddress: 'Ai66LHpumpTokenMint111111111111111111111111',
          networkId: solNetworkId,
          isNative: false,
        },
      ),
    ).toBe(false);
  });

  it('does not match two different placeholder networks', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: 'bitcoin', networkId: 'coingecko' },
        { tokenAddress: 'ethereum', networkId: 'unknown', isNative: false },
      ),
    ).toBe(false);
  });

  it('matches a CoinGecko placeholder network with BTC', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: '', networkId: 'coingecko' },
        { tokenAddress: 'bitcoin', networkId: btcNetworkId, isNative: false },
      ),
    ).toBe(true);
  });

  it('does not match an empty placeholder preview with an empty native detail', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: '', networkId: 'coingecko' },
        { tokenAddress: '', networkId: btcNetworkId, isNative: true },
      ),
    ).toBe(false);
  });
  it('does not match two different non-contract ids', () => {
    expect(
      isMatchingMarketTokenIdentity(
        { address: 'bitcoin', networkId: btcNetworkId },
        { tokenAddress: 'ethereum', networkId: btcNetworkId, isNative: false },
      ),
    ).toBe(false);
  });

  it('does not match two different contracts', () => {
    expect(
      isMatchingMarketTokenIdentity(
        {
          address: '0x0000000000000000000000000000000000000001',
          networkId: 'evm--1',
        },
        {
          tokenAddress: '0x0000000000000000000000000000000000000002',
          networkId: 'evm--1',
          isNative: false,
        },
      ),
    ).toBe(false);
  });

  it('matches a short-code network with the full network id', () => {
    expect(
      isMatchingMarketTokenIdentity(
        {
          address: 'Ai66LHpumpTokenMint111111111111111111111111',
          networkId: solNetworkId,
        },
        {
          tokenAddress: 'Ai66LHpumpTokenMint111111111111111111111111',
          networkId: 'sol',
          isNative: false,
        },
      ),
    ).toBe(true);
  });

  it('does not match Solana mint addresses that differ only by case', () => {
    expect(
      isMatchingMarketTokenIdentity(
        {
          address: 'Ai66LHpumpTokenMint111111111111111111111111',
          networkId: solNetworkId,
        },
        {
          tokenAddress: 'ai66lhpumptokenmint111111111111111111111111',
          networkId: solNetworkId,
          isNative: false,
        },
      ),
    ).toBe(false);
  });

  it('does not treat a ticker as a contract address', () => {
    expect(hasMarketContractAddress('bitcoin')).toBe(false);
    expect(
      hasMarketContractAddress('0x0000000000000000000000000000000000000001'),
    ).toBe(true);
    expect(hasMarketContractAddress('usdt.tether-token.near')).toBe(true);
  });

  it('matches a NEAR account id as the same contract', () => {
    expect(
      isMatchingMarketTokenIdentity(
        {
          address: 'usdt.tether-token.near',
          networkId: 'near--0',
        },
        {
          tokenAddress: 'usdt.tether-token.near',
          networkId: 'near--0',
          isNative: false,
        },
      ),
    ).toBe(true);
  });
});

describe('isMarketTokenDecimalsReady', () => {
  it('is false until decimals have resolved', () => {
    expect(
      isMarketTokenDecimalsReady({ decimals: 0, decimalsResolved: false }),
    ).toBe(false);
  });

  it('allows a resolved zero-decimal token', () => {
    expect(
      isMarketTokenDecimalsReady({ decimals: 0, decimalsResolved: true }),
    ).toBe(true);
  });
});
