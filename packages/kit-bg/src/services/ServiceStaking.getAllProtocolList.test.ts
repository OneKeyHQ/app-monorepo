import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

// The full-list fast path must reuse getProtocolList's gating semantics
// (review P1): locally disabled or client-unsupported protocols and
// WithdrawOnly rows must never surface on the aggregation pages, and rows
// without a symbol cannot be config-checked so they are dropped (which makes
// old symbol-less servers yield an empty list and pushes callers onto the
// per-symbol fan-out fallback).

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

  it('drops WithdrawOnly rows without consulting the config', async () => {
    const { service, getStakingConfigs } = createServiceHarness({
      protocols: [
        createProtocolItem({ symbol: 'USDT', provider: 'enabled-provider' }),
        createProtocolItem({
          symbol: 'USDT',
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
    ]);
    expect(getStakingConfigs).not.toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'withdraw-only-provider' }),
    );
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
