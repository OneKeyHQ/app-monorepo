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

import { act, renderHook, waitFor } from '@testing-library/react-native';

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

  it('ignores an outdated request while loading the current target', async () => {
    let resolveFirstRequest:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    let resolveSecondRequest:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondRequest = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useTrackTokenAllowance({
          ...params,
          accountId,
          initialValue: undefined,
        }),
      { initialProps: { accountId: 'account-1' } },
    );

    await waitFor(() =>
      expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(1),
    );
    rerender({ accountId: 'account-2' });
    await waitFor(() =>
      expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(2),
    );

    await act(async () => {
      resolveFirstRequest?.({
        allowance: '10000000',
        allowanceParsed: '10',
      });
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.allowance).toBe('0');

    await act(async () => {
      resolveSecondRequest?.({
        allowance: '20000000',
        allowanceParsed: '20',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.allowance).toBe('20');
    });
  });
});
