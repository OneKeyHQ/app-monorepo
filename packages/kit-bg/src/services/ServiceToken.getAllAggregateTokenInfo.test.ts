/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceToken from './ServiceToken';

import type { ISimpleDBAggregateToken } from '../dbs/simple/entity/SimpleDbEntityAggregateToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

// Mirrors the merged registry ServiceNetwork.getAllNetworks returns after
// dropping TRASH entries: presets plus server-delivered chains. evm--4663
// (Robinhood) is server-delivered only and never part of presetNetworks.
const DEFAULT_ELIGIBLE_NETWORK_IDS = [
  'evm--1',
  'tron--0x2b6653dc',
  'evm--4663',
];

function buildService(
  rawData: ISimpleDBAggregateToken | null,
  {
    eligibleNetworkIds = DEFAULT_ELIGIBLE_NETWORK_IDS,
    getAllNetworks,
  }: {
    eligibleNetworkIds?: string[];
    getAllNetworks?: jest.Mock;
  } = {},
) {
  const getAllNetworksMock =
    getAllNetworks ??
    jest.fn(async () => ({
      networks: eligibleNetworkIds.map((id) => ({ id })),
    }));
  const service = new ServiceToken({
    backgroundApi: {
      simpleDb: {
        aggregateToken: {
          getRawData: jest.fn(async () => rawData),
        },
      },
      serviceNetwork: {
        getAllNetworks: getAllNetworksMock,
      },
    },
  });
  return { service, getAllNetworksMock };
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

// Mirrors the aggregate descriptor shape built by
// ServiceSetting.syncWalletConfig from the map keys.
function buildAggregateToken($key: string) {
  return {
    $key,
    isAggregateToken: true,
    name: 'Tether',
    symbol: 'USDT',
    commonSymbol: 'USDT',
    networkId: '',
    address: $key,
    decimals: 0,
    isNative: false,
  };
}

describe('ServiceToken.getAllAggregateTokenInfo', () => {
  it('drops tokens on networks missing from the merged network registry', async () => {
    // evm--810180 (zkLink Nova) was removed from presetNetworks and
    // evm--321 (KCC) never existed there; both may still linger in an
    // aggregate-token cache persisted by an older app version.
    const { service } = buildService({
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
    const { service } = buildService({
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

  it('drops aggregate groups whose networks were all delisted', async () => {
    // evm--100 (Gnosis) was removed from presetNetworks, so the whole
    // XDAI aggregate group becomes empty after filtering and must be
    // dropped from both the map and the flat descriptor list.
    const { service } = buildService({
      allAggregateTokenMap: {
        sameSymbol_USDT: {
          tokens: [buildToken('evm--1'), buildToken('evm--810180')],
        },
        sameSymbol_XDAI: {
          tokens: [buildToken('evm--100')],
        },
      },
      allAggregateTokens: [
        buildAggregateToken('sameSymbol_USDT'),
        buildAggregateToken('sameSymbol_XDAI'),
      ],
    });

    const { allAggregateTokenMap, allAggregateTokens } =
      await service.getAllAggregateTokenInfo();

    expect(Object.keys(allAggregateTokenMap)).toEqual(['sameSymbol_USDT']);
    expect(allAggregateTokens.map((t) => t.$key)).toEqual(['sameSymbol_USDT']);
  });

  it('returns empty structures when nothing is cached', async () => {
    const { service } = buildService(null);

    const result = await service.getAllAggregateTokenInfo();

    expect(result).toEqual({
      allAggregateTokenMap: {},
      allAggregateTokens: [],
    });
  });

  it('keeps members on server-delivered networks absent from presetNetworks', async () => {
    // Regression: the 6.6.0 ETH aggregate lost its Robinhood tab because the
    // read path gated members on the preset-only listed map while the sync
    // path (ServiceSetting.syncWalletConfig) had already admitted evm--4663
    // from the merged registry.
    const { service, getAllNetworksMock } = buildService({
      allAggregateTokenMap: {
        sameSymbol_ETH: {
          tokens: [buildToken('evm--1'), buildToken('evm--4663')],
        },
      },
      allAggregateTokens: [buildAggregateToken('sameSymbol_ETH')],
    });

    const { allAggregateTokenMap } = await service.getAllAggregateTokenInfo();

    expect(
      allAggregateTokenMap.sameSymbol_ETH.tokens.map((t) => t.networkId),
    ).toEqual(['evm--1', 'evm--4663']);
    expect(getAllNetworksMock).toHaveBeenCalledWith({
      excludeCustomNetwork: true,
      excludeAllNetworkItem: true,
    });
  });

  it('drops server-delivered members once the registry no longer lists them', async () => {
    // getAllNetworks already removes TRASH entries, so a delisted server
    // chain simply disappears from the eligible set.
    const { service } = buildService(
      {
        allAggregateTokenMap: {
          sameSymbol_ETH: {
            tokens: [buildToken('evm--1'), buildToken('evm--4663')],
          },
        },
        allAggregateTokens: [buildAggregateToken('sameSymbol_ETH')],
      },
      { eligibleNetworkIds: ['evm--1'] },
    );

    const { allAggregateTokenMap } = await service.getAllAggregateTokenInfo();

    expect(
      allAggregateTokenMap.sameSymbol_ETH.tokens.map((t) => t.networkId),
    ).toEqual(['evm--1']);
  });

  it('fails open when the network registry cannot be read', async () => {
    const { service } = buildService(
      {
        allAggregateTokenMap: {
          sameSymbol_ETH: {
            tokens: [buildToken('evm--1'), buildToken('evm--4663')],
          },
        },
        allAggregateTokens: [buildAggregateToken('sameSymbol_ETH')],
      },
      {
        getAllNetworks: jest
          .fn()
          .mockRejectedValue(new OneKeyLocalError('registry unavailable')),
      },
    );

    const { allAggregateTokenMap } = await service.getAllAggregateTokenInfo();

    expect(
      allAggregateTokenMap.sameSymbol_ETH.tokens.map((t) => t.networkId),
    ).toEqual(['evm--1', 'evm--4663']);
  });
});
