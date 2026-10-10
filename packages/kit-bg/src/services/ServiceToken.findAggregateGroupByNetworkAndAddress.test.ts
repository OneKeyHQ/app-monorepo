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

const ELIGIBLE_NETWORK_IDS = ['evm--1', 'tron--0x2b6653dc', 'sol--101'];

function buildMember(networkId: string, address: string) {
  return {
    $key: `aggregate_USDT_${networkId}`,
    networkId,
    name: 'Tether',
    symbol: 'USDT',
    commonSymbol: 'USDT',
    address,
    decimals: 6,
    isNative: false,
  };
}

const USDT_GROUP = {
  aggregateToken: {
    $key: 'aggregate_USDT_',
    isAggregateToken: true,
    name: 'Tether',
    symbol: 'USDT',
    commonSymbol: 'USDT',
    networkId: '',
    address: 'aggregate_USDT_',
    decimals: 0,
    isNative: false,
  },
  members: [
    buildMember('evm--1', '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
    buildMember('tron--0x2b6653dc', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
  ],
};

function buildRawData(): ISimpleDBAggregateToken {
  return {
    aggregateTokenConfigMap: {
      'evm--1_0xdac17f958d2ee523a2206206994597c13d831ec7': {
        commonSymbol: 'USDT',
      } as any,
      'tron--0x2b6653dc_tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t': {
        commonSymbol: 'USDT',
      } as any,
      // Native coin grouped under an empty address.
      'evm--1_': { commonSymbol: 'ETH' } as any,
    },
    allAggregateTokenMap: {
      aggregate_USDT_: { tokens: USDT_GROUP.members },
      aggregate_ETH_: {
        tokens: [
          { ...buildMember('evm--1', ''), $key: 'aggregate_ETH_evm--1' },
          {
            ...buildMember('evm--42161', ''),
            $key: 'aggregate_ETH_evm--42161',
          },
        ],
      },
    },
    allAggregateTokens: [
      USDT_GROUP.aggregateToken,
      {
        ...USDT_GROUP.aggregateToken,
        $key: 'aggregate_ETH_',
        commonSymbol: 'ETH',
      },
    ],
  };
}

function buildService(rawData: ISimpleDBAggregateToken | null) {
  const getRawData = jest.fn(async () => rawData);
  const service = new ServiceToken({
    backgroundApi: {
      simpleDb: {
        aggregateToken: {
          getRawData,
        },
      },
      serviceNetwork: {
        getAllNetworks: jest.fn(async () => ({
          networks: ELIGIBLE_NETWORK_IDS.map((id) => ({ id })),
        })),
      },
      serviceCustomRpc: {
        isServerNetworkRegistryFilled: jest.fn(async () => true),
        ensureServerNetworksFetched: jest.fn(async () => undefined),
      },
    },
  });
  return Object.assign(service, { getRawData });
}

describe('ServiceToken.findAggregateGroupByNetworkAndAddress', () => {
  it('matches the contract address case-insensitively with a single raw read', async () => {
    const service = buildService(buildRawData());
    const result = await service.findAggregateGroupByNetworkAndAddress({
      networkId: 'evm--1',
      address: '0xDAC17F958D2EE523A2206206994597C13D831EC7',
    });
    expect(result?.aggregateToken.$key).toBe('aggregate_USDT_');
    expect(result?.members.map((m) => m.networkId)).toEqual([
      'evm--1',
      'tron--0x2b6653dc',
    ]);
    expect(service.getRawData).toHaveBeenCalledTimes(1);
  });

  it('falls back to the empty address for native coins', async () => {
    const service = buildService(buildRawData());
    const result = await service.findAggregateGroupByNetworkAndAddress({
      networkId: 'evm--1',
      address: '',
    });
    expect(result?.aggregateToken.$key).toBe('aggregate_ETH_');
    // evm--42161 is not in the eligible registry and is dropped.
    expect(result?.members.map((m) => m.networkId)).toEqual(['evm--1']);
  });

  it('falls back to the empty address for a native coin spelled with one', async () => {
    const service = buildService(buildRawData());
    const result = await service.findAggregateGroupByNetworkAndAddress({
      networkId: 'evm--1',
      address: 'native-coin',
      isNative: true,
    });
    expect(result?.aggregateToken.$key).toBe('aggregate_ETH_');
  });

  it('never resolves a contract token to the native coin group of its network', async () => {
    const service = buildService(buildRawData());
    // Not part of any group, on a network whose native coin is grouped.
    await expect(
      service.findAggregateGroupByNetworkAndAddress({
        networkId: 'evm--1',
        address: '0x000000000000000000000000000000000000dEaD',
        isNative: false,
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.findAggregateGroupByNetworkAndAddress({
        networkId: 'evm--1',
        address: '0x000000000000000000000000000000000000dEaD',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns undefined for a token outside every group', async () => {
    const service = buildService(buildRawData());
    await expect(
      service.findAggregateGroupByNetworkAndAddress({
        networkId: 'tron--0x2b6653dc',
        address: '',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns undefined when the wallet config has not synced', async () => {
    const service = buildService(null);
    await expect(
      service.findAggregateGroupByNetworkAndAddress({
        networkId: 'evm--1',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      }),
    ).resolves.toBeUndefined();
  });
});
