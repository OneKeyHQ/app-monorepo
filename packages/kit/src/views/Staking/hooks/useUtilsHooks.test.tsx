/* eslint-disable import/first */

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchTxDetails: jest.fn(),
    },
    serviceStaking: {
      fetchTokenAllowance: jest.fn(),
    },
  },
}));

import { renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { useTrackTokenAllowance } from './useUtilsHooks';

const serviceStaking = jest.mocked(backgroundApiProxy.serviceStaking);

const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  spenderAddress: '0xspender',
  tokenAddress: '0xtoken',
};

describe('useTrackTokenAllowance', () => {
  beforeEach(() => {
    serviceStaking.fetchTokenAllowance.mockReset();
    serviceStaking.fetchTokenAllowance.mockResolvedValue({
      allowance: '10000000',
      allowanceParsed: '10',
    });
  });

  it('fetches the allowance when its initial value is unknown', async () => {
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: undefined }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.allowance).toBe('10');
    });
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(1);
  });

  it('uses a known initial allowance without fetching it again', () => {
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: '5' }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.allowance).toBe('5');
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(0);
  });

  it('keeps the fallback allowance when the initial fetch fails', async () => {
    serviceStaking.fetchTokenAllowance.mockRejectedValue(
      new Error('network error'),
    );
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: undefined }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowance).toBe('0');
  });
});
