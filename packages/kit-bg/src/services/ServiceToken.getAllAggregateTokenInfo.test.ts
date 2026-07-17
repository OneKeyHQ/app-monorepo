/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import ServiceToken from './ServiceToken';

import type { ISimpleDBAggregateToken } from '../dbs/simple/entity/SimpleDbEntityAggregateToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

function buildService(rawData: ISimpleDBAggregateToken | null) {
  return new ServiceToken({
    backgroundApi: {
      simpleDb: {
        aggregateToken: {
          getRawData: jest.fn(async () => rawData),
        },
      },
    },
  });
}

function buildToken(networkId: string) {
  return {
    $key: `sameSymbol_${networkId}`,
    networkId,
    name: 'Tether',
    symbol: 'USDT',
    address: '0xusdt',
    decimals: 6,
    isNative: false,
  };
}

describe('ServiceToken.getAllAggregateTokenInfo', () => {
  it('drops tokens on networks missing from the bundled preset list', async () => {
    // evm--810180 (zkLink Nova) was removed from presetNetworks and
    // evm--321 (KCC) never existed there; both may still linger in an
    // aggregate-token cache persisted by an older app version.
    const service = buildService({
      allAggregateTokenMap: {
        sameSymbol_USDT: {
          tokens: [
            buildToken('evm--1'),
            buildToken('evm--810180'),
            buildToken('evm--321'),
          ],
        },
      },
      allAggregateTokens: [],
    });

    const { allAggregateTokenMap } = await service.getAllAggregateTokenInfo();

    expect(
      allAggregateTokenMap.sameSymbol_USDT.tokens.map((t) => t.networkId),
    ).toEqual(['evm--1']);
  });

  it('keeps tokens on bundled listed networks intact', async () => {
    const service = buildService({
      allAggregateTokenMap: {
        sameSymbol_USDT: {
          tokens: [buildToken('evm--1'), buildToken('tron--0x2b6653dc')],
        },
      },
      allAggregateTokens: [],
    });

    const { allAggregateTokenMap } = await service.getAllAggregateTokenInfo();

    expect(
      allAggregateTokenMap.sameSymbol_USDT.tokens.map((t) => t.networkId),
    ).toEqual(['evm--1', 'tron--0x2b6653dc']);
  });

  it('returns empty structures when nothing is cached', async () => {
    const service = buildService(null);

    const result = await service.getAllAggregateTokenInfo();

    expect(result).toEqual({
      allAggregateTokenMap: {},
      allAggregateTokens: [],
    });
  });
});
