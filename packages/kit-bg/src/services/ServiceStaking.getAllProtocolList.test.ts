import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

// The full-list fast path must reuse getProtocolList's enabled gating
// (review P1): locally disabled or client-unsupported protocols must never
// surface on the aggregation pages. WithdrawOnly rows are kept (OK-59305) so
// sunset protocols stay reachable for redeem.
//
// An empty array is the "response not usable, fall back to the per-symbol
// fan-out" signal. It is returned whenever the fast path cannot produce a
// complete list — a response missing symbols on any row, or a config lookup
// that threw — rather than silently handing back a subset the caller would
// treat as complete (PR 12791 review P1).

function createProtocolItem({
  symbol,
  provider,
  networkId = 'evm--1',
  group = EStakeProtocolGroupEnum.Available,
}: {
  symbol?: string;
  provider: string;
  networkId?: string;
  group?: EStakeProtocolGroupEnum;
}): IStakeProtocolListItem {
  return {
    symbol,
    network: { networkId, name: networkId, logoURI: '' },
    provider: {
      name: provider,
      logoURI: '',
      group,
    },
  } as unknown as IStakeProtocolListItem;
}

function createServiceHarness({
  protocols,
  enabledByProvider,
}: {
  protocols: IStakeProtocolListItem[];
  enabledByProvider: Record<string, boolean | undefined>;
}) {
  const service = new ServiceStaking({ backgroundApi: {} });
  const post = jest.fn().mockResolvedValue({ data: { data: { protocols } } });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ post } as unknown as AxiosInstance);
  const getStakingConfigs = jest
    .spyOn(service, 'getStakingConfigs')
    .mockImplementation(async ({ provider }) => {
      const enabled = enabledByProvider[provider];
      // Unknown provider (client-unsupported) mirrors the real
      // implementation's null return
      if (enabled === undefined) {
        return null;
      }
      return { enabled } as Awaited<
        ReturnType<ServiceStaking['getStakingConfigs']>
      >;
    });
  return { service, post, getStakingConfigs };
}

describe('ServiceStaking.getAllProtocolList gating', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('keeps only rows whose staking config is enabled', async () => {
    const { service } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'enabled-provider' }),
        createProtocolItem({ symbol: 'USDC', provider: 'disabled-provider' }),
      ],
      enabledByProvider: {
        'enabled-provider': true,
        'disabled-provider': false,
      },
    });

    const result = await service.getAllProtocolList();

    expect(result).toHaveLength(1);
    expect(result[0].provider.name).toBe('enabled-provider');
  });

  it('drops rows the client has no staking config for (null config)', async () => {
    const { service } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'known-provider' }),
        createProtocolItem({ symbol: 'ATOM', provider: 'unknown-provider' }),
      ],
      enabledByProvider: { 'known-provider': true },
    });

    const result = await service.getAllProtocolList();

    expect(result.map((item) => item.provider.name)).toEqual([
      'known-provider',
    ]);
  });

  it('keeps WithdrawOnly rows so sunset protocols stay reachable (OK-59305)', async () => {
    const { service } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'enabled-provider' }),
        createProtocolItem({
          symbol: 'ETH',
          provider: 'withdraw-only-provider',
          group: EStakeProtocolGroupEnum.WithdrawOnly,
        }),
      ],
      enabledByProvider: {
        'enabled-provider': true,
        'withdraw-only-provider': true,
      },
    });

    const result = await service.getAllProtocolList();

    expect(result.map((item) => item.provider.name)).toEqual([
      'enabled-provider',
      'withdraw-only-provider',
    ]);
  });

  it('drops symbol-less rows so old servers fall back to fan-out', async () => {
    const { service, getStakingConfigs } = createServiceHarness({
      protocols: [
        createProtocolItem({ provider: 'enabled-provider' }),
        createProtocolItem({ provider: 'other-provider' }),
      ],
      enabledByProvider: { 'enabled-provider': true, 'other-provider': true },
    });

    const result = await service.getAllProtocolList();

    expect(result).toEqual([]);
    expect(getStakingConfigs).not.toHaveBeenCalled();
  });

  it('reports a partially symbol-less response as unusable rather than a subset (PR 12791 review P1)', async () => {
    const { service, getStakingConfigs } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'enabled-provider' }),
        createProtocolItem({ provider: 'symbol-less-provider' }),
      ],
      enabledByProvider: {
        'enabled-provider': true,
        'symbol-less-provider': true,
      },
    });

    const result = await service.getAllProtocolList();

    // Returning only the symbol-bearing row would look complete to the caller
    // and silently hide the rest of the providers
    expect(result).toEqual([]);
    expect(getStakingConfigs).not.toHaveBeenCalled();
  });

  it('reports the fast path as unusable when a config lookup throws (PR 12791 review P1)', async () => {
    const { service } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'enabled-provider' }),
        createProtocolItem({ symbol: 'USDC', provider: 'throwing-provider' }),
      ],
      enabledByProvider: { 'enabled-provider': true },
    });
    jest
      .spyOn(service, 'getStakingConfigs')
      .mockImplementation(async ({ provider }) => {
        if (provider === 'throwing-provider') {
          throw new OneKeyLocalError('vault settings unavailable');
        }
        return { enabled: true } as Awaited<
          ReturnType<ServiceStaking['getStakingConfigs']>
        >;
      });

    const result = await service.getAllProtocolList();

    // A transient lookup failure must not silently drop that provider from the
    // aggregation pages while the rest still renders as if complete
    expect(result).toEqual([]);
  });

  it('checks the config with each row own symbol/network/provider', async () => {
    const { service, getStakingConfigs } = createServiceHarness({
      protocols: [
        createProtocolItem({
          symbol: 'USDT',
          provider: 'enabled-provider',
          networkId: 'evm--42161',
        }),
      ],
      enabledByProvider: { 'enabled-provider': true },
    });

    await service.getAllProtocolList();

    expect(getStakingConfigs).toHaveBeenCalledWith({
      networkId: 'evm--42161',
      symbol: 'USDT',
      provider: 'enabled-provider',
    });
  });
});
