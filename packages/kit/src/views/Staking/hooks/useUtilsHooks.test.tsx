/* eslint-disable import/first */

const mockFetchTxDetails = jest.fn(async (_params: { txid: string }) => ({
  data: { status: '1' },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchTxDetails: (params: { txid: string }) => mockFetchTxDetails(params),
    },
    serviceStaking: {
      fetchTokenAllowance: jest.fn(),
    },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { trackEtherFiApproval, useTrackTokenAllowance } from './useUtilsHooks';

const serviceStaking = jest.mocked(backgroundApiProxy.serviceStaking);

const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  spenderAddress: '0xspender',
  tokenAddress: '0xtoken',
};

describe('useTrackTokenAllowance', () => {
  beforeEach(() => {
    mockFetchTxDetails.mockClear();
    mockFetchTxDetails.mockImplementation(async () => ({
      data: { status: '1' },
    }));
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

  it('applies a verified allowance only to the matching token scope', () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useTrackTokenAllowance({ ...params, accountId, initialValue: '0' }),
      { initialProps: { accountId: 'account-1' } },
    );
    const applyForFirstAccount = result.current.applyVerifiedAllowance;
    act(() => {
      applyForFirstAccount('10');
    });
    expect(result.current.allowance).toBe('10');
    rerender({ accountId: 'account-2' });
    act(() => {
      applyForFirstAccount('100');
    });
    expect(result.current.allowance).toBe('0');
    rerender({ accountId: 'account-1' });
    act(() => {
      applyForFirstAccount('100');
    });
    expect(result.current.allowance).toBe('0');
  });

  it('keeps a verified allowance when an older initial read completes later', async () => {
    let resolveInitialRead:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialRead = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: undefined }),
    );

    await waitFor(() => expect(resolveInitialRead).toBeDefined());
    act(() => {
      result.current.applyVerifiedAllowance('10');
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.allowance).toBe('10');

    await act(async () => {
      resolveInitialRead?.({ allowance: '0', allowanceParsed: '0' });
      await Promise.resolve();
    });
    expect(result.current.allowance).toBe('10');
    expect(result.current.loading).toBe(false);
  });

  it('does not let an older approval read overwrite a newer chain read', async () => {
    let resolveOld:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    let resolveNew:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }),
      );
    const { result } = renderHook(() =>
      useTrackTokenAllowance({ ...params, initialValue: '0' }),
    );
    const oldRead = result.current.fetchAllowanceResponse();
    const newRead = result.current.fetchAllowanceResponse();
    await act(async () => {
      resolveNew?.({ allowance: '10', allowanceParsed: '10' });
      const newer = await newRead;
      expect(
        result.current.applyVerifiedAllowance(
          newer.allowanceParsed,
          newer.allowanceRequestSequence,
        ),
      ).toBe(true);
    });
    await act(async () => {
      resolveOld?.({ allowance: '0', allowanceParsed: '0' });
      const older = await oldRead;
      expect(
        result.current.applyVerifiedAllowance(
          older.allowanceParsed,
          older.allowanceRequestSequence,
        ),
      ).toBe(false);
    });
    expect(result.current.allowance).toBe('10');
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

  it('rechecks a changed seed without replacing a newer verified allowance', async () => {
    let resolveRefresh:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance
      .mockResolvedValueOnce({ allowance: '0', allowanceParsed: '0' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) =>
        useTrackTokenAllowance({
          ...params,
          initialValue,
          refreshOnMount: true,
          refreshTrackedEtherFiApproval: true,
        }),
      { initialProps: { initialValue: '0' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.applyVerifiedAllowance('10');
    });
    rerender({ initialValue: '1' });
    expect(result.current.loading).toBe(true);
    expect(result.current.allowance).toBe('10');
    await act(async () => {
      resolveRefresh?.({ allowance: '10', allowanceParsed: '10' });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowance).toBe('10');
  });

  it('does not reset a verified EtherFi allowance when focus changes', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTrackTokenAllowance({
          ...params,
          initialValue: '0',
          refreshTrackedEtherFiApproval: true,
          etherFiApprovalTrackingActive: active,
        }),
      { initialProps: { active: true } },
    );
    act(() => {
      result.current.applyVerifiedAllowance('10');
    });
    rerender({ active: false });
    expect(result.current.allowance).toBe('10');
    rerender({ active: true });
    expect(result.current.allowance).toBe('10');
  });

  it('keeps a verified allowance when the EtherFi withdrawal path becomes known', async () => {
    const { result, rerender } = renderHook(
      ({ tracking }: { tracking: boolean }) =>
        useTrackTokenAllowance({
          ...params,
          initialValue: undefined,
          refreshTrackedEtherFiApproval: tracking,
        }),
      { initialProps: { tracking: false } },
    );
    await waitFor(() => expect(result.current.allowance).toBe('10'));
    rerender({ tracking: true });
    expect(result.current.allowance).toBe('10');
    expect(result.current.loading).toBe(false);
  });

  it('still applies changed seeds for other users of the shared hook', () => {
    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) =>
        useTrackTokenAllowance({ ...params, initialValue }),
      { initialProps: { initialValue: '10' } },
    );
    rerender({ initialValue: '0' });
    expect(result.current.allowance).toBe('0');
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

  it('continues reading a tracked approval until the chain allowance is sufficient', async () => {
    jest.useFakeTimers();
    const scope = {
      ...params,
      accountId: 'tracked-account',
      accountAddress: '0xowner',
    };
    serviceStaking.fetchTokenAllowance
      .mockResolvedValueOnce({ allowance: '0', allowanceParsed: '0' })
      .mockResolvedValueOnce({ allowance: '10', allowanceParsed: '10' });
    const { result, unmount } = renderHook(() =>
      useTrackTokenAllowance({
        ...scope,
        expectedAccountAddress: scope.accountAddress,
        initialValue: '0',
        refreshTrackedEtherFiApproval: true,
      }),
    );
    await act(async () => {
      trackEtherFiApproval(scope, '0xtx-tracked-1', '10');
      await Promise.resolve();
    });
    expect(result.current.allowance).toBe('0');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.allowance).toBe('10');
    expect(serviceStaking.fetchTokenAllowance.mock.calls).toHaveLength(2);
    unmount();
    jest.useRealTimers();
  });

  it('ignores a tracked approval response after switching accounts', async () => {
    let resolveRead:
      | ((value: { allowance: string; allowanceParsed: string }) => void)
      | undefined;
    serviceStaking.fetchTokenAllowance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const scope = {
      ...params,
      accountId: 'tracked-old-account',
      accountAddress: '0xowner',
    };
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useTrackTokenAllowance({
          ...scope,
          accountId,
          expectedAccountAddress: scope.accountAddress,
          initialValue: '0',
          refreshTrackedEtherFiApproval: true,
        }),
      { initialProps: { accountId: scope.accountId } },
    );
    act(() => trackEtherFiApproval(scope, '0xtx-tracked-2', '10'));
    rerender({ accountId: 'tracked-new-account' });
    await act(async () => {
      resolveRead?.({ allowance: '10', allowanceParsed: '10' });
      await Promise.resolve();
    });
    expect(result.current.allowance).toBe('0');
  });

  it('keeps multiple approvals separate until each transaction settles', async () => {
    jest.useFakeTimers();
    const scope = {
      ...params,
      accountId: 'multiple-approval-account',
      accountAddress: '0xowner',
    };
    let firstConfirmed = false;
    mockFetchTxDetails.mockImplementation(async ({ txid }) => ({
      data: { status: txid === '0xtx-first' && !firstConfirmed ? '2' : '1' },
    }));
    serviceStaking.fetchTokenAllowance
      .mockResolvedValueOnce({ allowance: '50', allowanceParsed: '50' })
      .mockResolvedValueOnce({ allowance: '100', allowanceParsed: '100' });
    const { result, unmount } = renderHook(() =>
      useTrackTokenAllowance({
        ...scope,
        expectedAccountAddress: scope.accountAddress,
        initialValue: '0',
        refreshTrackedEtherFiApproval: true,
      }),
    );
    await act(async () => {
      trackEtherFiApproval(scope, '0xtx-first', '100');
      trackEtherFiApproval(scope, '0xtx-second', '50');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.allowance).toBe('50');
    firstConfirmed = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.allowance).toBe('100');
    expect(
      mockFetchTxDetails.mock.calls.filter(
        ([arg]) => arg.txid === '0xtx-first',
      ),
    ).toHaveLength(2);
    unmount();
    jest.useRealTimers();
  });

  it.each(['transaction status', 'allowance'] as const)(
    'recovers when a %s request hangs',
    async (hangingRequest) => {
      jest.useFakeTimers();
      const scope = {
        ...params,
        accountId: `hang-${hangingRequest}`,
        accountAddress: '0xowner',
      };
      if (hangingRequest === 'transaction status') {
        mockFetchTxDetails.mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      } else {
        serviceStaking.fetchTokenAllowance.mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      }
      const { result, unmount } = renderHook(() =>
        useTrackTokenAllowance({
          ...scope,
          expectedAccountAddress: scope.accountAddress,
          initialValue: '0',
          refreshTrackedEtherFiApproval: true,
        }),
      );
      await act(async () => {
        trackEtherFiApproval(scope, `0xtx-${hangingRequest}`, '10');
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });
      expect(result.current.allowance).toBe('10');
      unmount();
      jest.useRealTimers();
    },
  );

  it('keeps retrying with backoff after three timeouts while the form stays focused', async () => {
    jest.useFakeTimers();
    const scope = {
      ...params,
      accountId: 'multiple-timeouts-account',
      accountAddress: '0xowner',
    };
    mockFetchTxDetails
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { result, unmount } = renderHook(() =>
      useTrackTokenAllowance({
        ...scope,
        expectedAccountAddress: scope.accountAddress,
        initialValue: '0',
        refreshTrackedEtherFiApproval: true,
      }),
    );
    await act(async () => {
      trackEtherFiApproval(scope, '0xtx-multiple-timeouts', '10');
      await Promise.resolve();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(55_000);
    });
    expect(result.current.allowance).toBe('10');
    expect(mockFetchTxDetails).toHaveBeenCalledTimes(4);
    unmount();
    jest.useRealTimers();
  });
});
