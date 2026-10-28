/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useEtherFiLegacyApproval } from './useEtherFiLegacyApproval';

const allowance = jest.fn<Promise<{ allowanceParsed: string }>, [unknown]>();
const getAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const getXpub = jest.fn<Promise<string>, [unknown]>();
const getToken = jest.fn<
  Promise<{
    info: {
      address: string;
      decimals: number;
      symbol: string;
      isNative: boolean;
    };
  }>,
  [unknown]
>();
const confirm = jest.fn<
  Promise<void>,
  [
    {
      approvesInfo: Array<{
        spender: string;
        amount: string;
        tokenInfo: { address: string };
      }>;
      onSuccess: (data: Array<{ signedTx: { txid: string } }>) => void;
      onCancel: () => void;
    },
  ]
>();
const finalStatus = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const pendingTxs = jest.fn<
  Promise<
    Array<{
      replacedType?: EReplaceTxType;
      decodedTx: {
        txid: string;
        actions: Array<{
          tokenApprove: {
            spender: string;
            tokenIdOnNetwork: string;
            amount: string;
          };
        }>;
      };
    }>
  >,
  [unknown]
>();
const txDetails = jest.fn<
  Promise<{ data: { status: EOnChainHistoryTxStatus } }>,
  [unknown]
>();
const localHistoryTx = jest.fn<
  Promise<
    | {
        id: string;
        replacedNextId?: string;
        replacedType?: EReplaceTxType;
        decodedTx: { txid: string };
      }
    | undefined
  >,
  [{ accountId: string; networkId: string; historyId: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      fetchTokenAllowance: (arg: unknown) => allowance(arg),
    },
    serviceAccount: {
      getAccount: (arg: unknown) => getAccount(arg),
      getAccountAddressForApi: async () => '0xowner',
      getAccountXpub: (arg: unknown) => getXpub(arg),
    },
    serviceHistory: {
      getAccountLocalHistoryPendingTxs: (arg: unknown) => pendingTxs(arg),
      getLocalHistoryTxById: (arg: {
        accountId: string;
        networkId: string;
        historyId: string;
      }) => localHistoryTx(arg),
      fetchTxDetails: (arg: unknown) => txDetails(arg),
    },
    serviceToken: {
      fetchTokenInfoOnly: (arg: unknown) => getToken(arg),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: confirm }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (arg: unknown) => finalStatus(arg),
}));

const vault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
const queue = '0xd45884b592e316eb816199615a95c182f75dea07';
const params = {
  accountId: 'account',
  networkId: 'evm--1',
  provider: 'etherfi',
  vault,
};

describe('EtherFi legacy allowance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    getAccount.mockResolvedValue({ address: '0xowner' });
    getXpub.mockResolvedValue('');
    getToken.mockResolvedValue({
      info: {
        address: vault,
        decimals: 6,
        symbol: 'liquidUSD',
        isNative: false,
      },
    });
    confirm.mockResolvedValue(undefined);
    pendingTxs.mockResolvedValue([]);
  });

  it('skips other vaults and cancellation', () => {
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, vault: '0xother' }),
    );
    expect(result.current.blocked).toBe(false);
    expect(allowance).not.toHaveBeenCalled();
  });

  it('keeps unavailable or invalid allowance blocked', async () => {
    allowance.mockResolvedValue({ allowanceParsed: 'invalid' });
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('unknown'));
    expect(result.current.blocked).toBe(true);
  });

  it('blocks a pending revoke recovered from local transaction history', async () => {
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xtx',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '0',
              },
            },
          ],
        },
      },
    ]);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.blocked).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not treat a confirmed cancellation replacement as an approval', async () => {
    pendingTxs.mockResolvedValue([
      {
        replacedType: EReplaceTxType.Cancel,
        decodedTx: {
          txid: '0xcancel',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '0',
              },
            },
          ],
        },
      },
    ]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const onCleared = jest.fn();
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, onCleared }),
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('opens a revoke confirmation if the allowance changes before an action', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    let allowed = true;
    await act(async () => {
      allowed = await result.current.verifyBeforeAction();
    });
    expect(allowed).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0].approvesInfo[0]).toMatchObject({
      spender: queue,
      amount: '0',
      tokenInfo: { address: vault },
    });
    expect(result.current.blocked).toBe(true);
    act(() => confirm.mock.calls[0][0].onCancel());
    expect(result.current.status).toBe('required');
  });

  it('monitors a pending revoke discovered during the final allowance check', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xtx',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '0',
              },
            },
          ],
        },
      },
    ]);
    finalStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    let allowed = true;
    await act(async () => {
      allowed = await result.current.verifyBeforeAction();
    });
    expect(allowed).toBe(false);
    expect(result.current.status).toBe('pending');
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xtx' }),
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('revokes only the old queue and waits for confirmation and zero allowance', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValue({ allowanceParsed: '0' });
    finalStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const onCleared = jest.fn();
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, onCleared }),
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => {
      await result.current.revoke();
    });
    expect(confirm.mock.calls[0][0].approvesInfo[0]).toMatchObject({
      spender: queue,
      amount: '0',
      tokenInfo: { address: vault },
    });
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('clear'));
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('does not continue after cancellation or an unknown transaction status', async () => {
    finalStatus.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => {
      await result.current.revoke();
    });
    act(() => confirm.mock.calls[0][0].onCancel());
    expect(result.current.status).toBe('required');
    await act(async () => {
      await result.current.revoke();
    });
    act(() =>
      confirm.mock.calls[1][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.blocked).toBe(true);
  });

  it('recovers a completed cancellation by following the local replacement chain', async () => {
    finalStatus.mockResolvedValue(undefined);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Success },
    });
    localHistoryTx.mockImplementation(async ({ historyId }) => {
      if (historyId === 'evm--1_0xtx_0xowner_') {
        return {
          id: historyId,
          replacedNextId: 'speedup',
          decodedTx: { txid: '0xtx' },
        };
      }
      if (historyId === 'speedup') {
        return {
          id: historyId,
          replacedNextId: 'cancel',
          replacedType: EReplaceTxType.SpeedUp,
          decodedTx: { txid: '0xspeedup' },
        };
      }
      if (historyId === 'cancel') {
        return {
          id: historyId,
          replacedType: EReplaceTxType.Cancel,
          decodedTx: { txid: '0xcancel' },
        };
      }
      return undefined;
    });
    const onCleared = jest.fn();
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, onCleared }),
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('required');
    expect(txDetails).toHaveBeenCalledWith({
      accountId: 'account',
      networkId: 'evm--1',
      txid: '0xcancel',
    });
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('keeps a replaced revoke pending when replacement history is incomplete', async () => {
    finalStatus.mockResolvedValue(undefined);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    localHistoryTx.mockImplementation(async ({ historyId }) =>
      historyId === 'evm--1_0xtx_0xowner_'
        ? {
            id: historyId,
            replacedNextId: 'missing',
            decodedTx: { txid: '0xtx' },
          }
        : undefined,
    );
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('remains blocked when another matching revoke is still pending', async () => {
    finalStatus.mockResolvedValue(undefined);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    localHistoryTx.mockImplementation(async ({ historyId }) => {
      if (historyId === 'evm--1_0xtx_0xowner_') {
        return {
          id: historyId,
          replacedNextId: 'cancel',
          decodedTx: { txid: '0xtx' },
        };
      }
      if (historyId === 'cancel') {
        return {
          id: historyId,
          replacedType: EReplaceTxType.Cancel,
          decodedTx: { txid: '0xcancel' },
        };
      }
      return undefined;
    });
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '0',
              },
            },
          ],
        },
      },
    ]);
    getXpub.mockRejectedValue(new Error('xpub unavailable'));
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
    expect(txDetails).toHaveBeenCalledWith({
      accountId: 'account',
      networkId: 'evm--1',
      txid: '0xother',
    });
    expect(getXpub).not.toHaveBeenCalled();
    expect(localHistoryTx).not.toHaveBeenCalled();
  });

  it('does not require xpub for the normal allowance check', async () => {
    getXpub.mockRejectedValue(new Error('xpub unavailable'));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    expect(getXpub).not.toHaveBeenCalled();
  });

  it('keeps an unknown broadcast pending when no transaction id was returned', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() => confirm.mock.calls[0][0].onSuccess([]));
    expect(result.current.status).toBe('pending');
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    expect(localHistoryTx).not.toHaveBeenCalled();
  });

  it('keeps the cleared state when an older pending refresh finishes later', async () => {
    let resolveStatus: (status: EOnChainHistoryTxStatus) => void = () =>
      undefined;
    let resolveDetails: (value: {
      data: { status: EOnChainHistoryTxStatus };
    }) => void = () => undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValue({ allowanceParsed: '0' });
    finalStatus.mockImplementation(
      () => new Promise((resolve) => (resolveStatus = resolve)),
    );
    txDetails.mockImplementation(
      () => new Promise((resolve) => (resolveDetails = resolve)),
    );
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xtx',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '0',
              },
            },
          ],
        },
      },
    ]);
    let retry: Promise<void> | undefined;
    act(() => {
      retry = result.current.refresh();
    });
    await waitFor(() => expect(txDetails).toHaveBeenCalledTimes(1));
    await act(async () => resolveStatus(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    await act(async () => {
      resolveDetails({ data: { status: EOnChainHistoryTxStatus.Pending } });
      await retry;
    });
    expect(result.current.status).toBe('clear');
  });

  it('ignores a replacement lookup that resolves after switching accounts', async () => {
    finalStatus.mockResolvedValue(undefined);
    let resolveHistory: (value: {
      id: string;
      replacedNextId: string;
      decodedTx: { txid: string };
    }) => void = () => undefined;
    localHistoryTx.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      (p: typeof params) => useEtherFiLegacyApproval(p),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xtx' } }]),
    );
    await waitFor(() => expect(result.current.status).toBe('pending'));
    let pendingRefresh: Promise<void> | undefined;
    act(() => {
      pendingRefresh = result.current.refresh();
    });
    await waitFor(() => expect(localHistoryTx).toHaveBeenCalledTimes(1));
    rerender({ ...params, accountId: 'other' });
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => {
      resolveHistory({
        id: 'evm--1_0xtx_0xowner_',
        replacedNextId: 'replacement',
        decodedTx: { txid: '0xtx' },
      });
      await pendingRefresh;
    });
    expect(result.current.status).toBe('required');
    expect(txDetails).not.toHaveBeenCalled();
  });

  it('ignores a late result after switching accounts', async () => {
    let resolveOld: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ allowanceParsed: '1' });
    const { result, rerender } = renderHook(
      (p: typeof params) => useEtherFiLegacyApproval(p),
      { initialProps: params },
    );
    rerender({ ...params, accountId: 'other' });
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => resolveOld({ allowanceParsed: '0' }));
    expect(result.current.status).toBe('required');
  });

  it('does not open a revoke confirmation for an outdated account', async () => {
    let resolveOld: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ allowanceParsed: '0' });
    const { result, rerender } = renderHook(
      (p: typeof params) => useEtherFiLegacyApproval(p),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('clear'));
    let verification: Promise<boolean> | undefined;
    act(() => {
      verification = result.current.verifyBeforeAction();
    });
    rerender({ ...params, accountId: 'other' });
    await waitFor(() => expect(result.current.status).toBe('clear'));
    await act(async () => {
      resolveOld({ allowanceParsed: '1' });
      expect(await verification).toBe(false);
    });
    expect(confirm).not.toHaveBeenCalled();
  });
});
