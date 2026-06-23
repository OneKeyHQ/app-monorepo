import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import { clearSelectedIpForHostCache } from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';

import { SimpleDbEntityIpTable } from './SimpleDbEntityIpTable';

import type { ISimpleDbIpTableData } from './SimpleDbEntityIpTable';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/request/helpers/ipTableAdapter', () => ({
  clearSelectedIpForHostCache: jest.fn(),
}));

const clearSelectedIpForHostCacheMock =
  clearSelectedIpForHostCache as jest.Mock;

describe('SimpleDbEntityIpTable.markIpQuarantined', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores the failed IP quarantine and prunes expired entries', async () => {
    const entity = new SimpleDbEntityIpTable();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue({} as ISimpleDbIpTableData);
    const timestamp = 1_800_000_000_000;

    await entity.markIpQuarantined('onekeycn.com', '216.19.4.106', {
      hostname: 'utility.onekeycn.com',
      error: 'Request timeout',
      timestamp,
    });

    expect(setRawData).toHaveBeenCalledWith(expect.any(Function));

    const updater = setRawData.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');

    const nextData = (
      updater as (data: ISimpleDbIpTableData) => ISimpleDbIpTableData
    )({
      config: DEFAULT_IP_TABLE_CONFIG,
      currentRegion: 'CN',
      runtime: {
        enabled: true,
        lastUpdated: 123,
        lastRegionCheck: 456,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
        quarantinedIps: {
          'onekeycn.com': {
            '104.18.20.233': {
              lastFailureTime: timestamp - 1000,
              hostname: 'wallet.onekeycn.com',
              error: 'Temporary failure',
            },
            '104.18.21.233': {
              lastFailureTime: timestamp - 31 * 60 * 1000,
              hostname: 'utility.onekeycn.com',
              error: 'Expired failure',
            },
          },
        },
      },
      version: 1,
    });

    expect(nextData).toMatchObject({
      config: DEFAULT_IP_TABLE_CONFIG,
      currentRegion: 'CN',
      runtime: {
        enabled: true,
        lastUpdated: 123,
        lastRegionCheck: 456,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
        quarantinedIps: {
          'onekeycn.com': {
            '104.18.20.233': {
              lastFailureTime: timestamp - 1000,
              hostname: 'wallet.onekeycn.com',
              error: 'Temporary failure',
            },
            '216.19.4.106': {
              lastFailureTime: timestamp,
              hostname: 'utility.onekeycn.com',
              error: 'Request timeout',
            },
          },
        },
      },
      version: 1,
    });
    expect(
      nextData.runtime?.quarantinedIps?.['onekeycn.com']?.['104.18.21.233'],
    ).toBeUndefined();
    expect(clearSelectedIpForHostCacheMock).toHaveBeenCalledTimes(1);
  });
});
