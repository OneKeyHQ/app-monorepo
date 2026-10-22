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

import {
  EtherFiLiquidReferContract,
  MorphoBundlerContract,
} from '@onekeyhq/shared/src/consts/addresses';
import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { useTrackTokenAllowance } from './useUtilsHooks';

const serviceStaking = jest.mocked(backgroundApiProxy.serviceStaking);
const serviceHistory = jest.mocked(backgroundApiProxy.serviceHistory);

const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  providerName: 'Spark',
  spenderAddress: '0xspender',
  tokenAddress: '0xtoken',
};

describe('useTrackTokenAllowance', () => {
  beforeEach(() => {
    serviceStaking.fetchTokenAllowance.mockReset();
    serviceHistory.fetchTxDetails.mockReset();
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
    expect(result.current.allowanceAvailable).toBe(false);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.allowance).toBe('10');
      expect(result.current.allowanceAvailable).toBe(true);
    });
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(1);
  });

  it('uses a known initial allowance without fetching it again', () => {
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: '5' }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.allowance).toBe('5');
    expect(result.current.allowanceAvailable).toBe(true);
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(0);
  });

  it('refreshes a seeded allowance when requested', async () => {
    const { result } = renderHook(() =>
      useTrackTokenAllowance({
        ...params,
        initialValue: '5',
        refreshOnMount: true,
      }),
    );

    expect(result.current.allowance).toBe('5');
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.allowance).toBe('10');
    });
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(1);
  });

  it('reconciles again when the seeded allowance changes', async () => {
    serviceStaking.fetchTokenAllowance
      .mockResolvedValueOnce({
        allowance: '10000000',
        allowanceParsed: '10',
      })
      .mockResolvedValueOnce({
        allowance: '20000000',
        allowanceParsed: '20',
      });
    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) =>
        useTrackTokenAllowance({
          ...params,
          initialValue,
          refreshOnMount: true,
        }),
      { initialProps: { initialValue: '5' } },
    );

    await waitFor(() => expect(result.current.allowance).toBe('10'));
    rerender({ initialValue: '6' });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.allowance).toBe('20');
    });
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(2);
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
    expect(result.current.allowanceAvailable).toBe(false);
  });

  it('distinguishes a confirmed zero allowance from an unavailable allowance', async () => {
    serviceStaking.fetchTokenAllowance.mockResolvedValue({
      allowance: '0',
      allowanceParsed: '0',
    });
    const { result } = renderHook(() =>
      useTrackTokenAllowance({
        ...params,
        refreshOnMount: true,
        initialValue: '0',
      }),
    );
    expect(result.current.allowanceAvailable).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowance).toBe('0');
    expect(result.current.allowanceAvailable).toBe(true);
  });

  it('invalidates a previously confirmed allowance when a later refresh fails', async () => {
    serviceHistory.fetchTxDetails.mockResolvedValue({
      data: {
        key: 'approve-tx',
        networkId: params.networkId,
        tx: '0xtx',
        riskLevel: 0,
        type: EOnChainHistoryTxType.Approve,
        sends: [],
        receives: [],
        status: EOnChainHistoryTxStatus.Success,
        from: '0xowner',
        to: params.tokenAddress,
        timestamp: 1,
        nonce: 1,
        gasFee: '0',
        gasFeeFiatValue: '0',
        functionCode: '',
        params: [],
        value: '0',
        label: '',
      },
      tokens: {},
      nfts: {},
    });
    const { result } = renderHook(() => useTrackTokenAllowance({ ...params }));
    await waitFor(() => expect(result.current.allowanceAvailable).toBe(true));
    serviceStaking.fetchTokenAllowance.mockRejectedValueOnce(
      new Error('refresh failed'),
    );
    act(() => result.current.trackAllowance('0xtx'));
    await waitFor(() => {
      expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(2);
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.allowance).toBe('10');
    expect(result.current.allowanceAvailable).toBe(false);
  });

  it('queries EtherFi Permit allowance on LiquidRefer instead of Morpho', async () => {
    const { result } = renderHook(() =>
      useTrackTokenAllowance({
        ...params,
        providerName: 'EtherFi',
        spenderAddress: EtherFiLiquidReferContract,
        approveType: EApproveType.Permit,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(serviceStaking.fetchTokenAllowance.mock.calls[0][0]).toEqual({
      accountId: params.accountId,
      networkId: params.networkId,
      tokenAddress: params.tokenAddress,
      spenderAddress: EtherFiLiquidReferContract,
    });
  });

  it('discards an outdated allowance when only the provider changes', async () => {
    let resolveFirstRequest:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstRequest = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ providerName }: { providerName: string }) =>
        useTrackTokenAllowance({
          ...params,
          providerName,
          approveType: EApproveType.Permit,
          spenderAddress: EtherFiLiquidReferContract,
        }),
      { initialProps: { providerName: 'Morpho' } },
    );

    await waitFor(() => {
      expect(serviceStaking.fetchTokenAllowance.mock.calls[0][0]).toEqual(
        expect.objectContaining({ spenderAddress: MorphoBundlerContract }),
      );
    });
    rerender({ providerName: 'EtherFi' });
    await waitFor(() => {
      expect(serviceStaking.fetchTokenAllowance.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ spenderAddress: EtherFiLiquidReferContract }),
      );
      expect(result.current.allowance).toBe('10');
    });

    await act(async () => {
      resolveFirstRequest?.({ allowance: '99000000', allowanceParsed: '99' });
      await Promise.resolve();
    });
    expect(result.current.allowance).toBe('10');
    expect(result.current.loading).toBe(false);
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
