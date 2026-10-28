/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useEtherFiLegacyApproval } from './useEtherFiLegacyApproval';

const allowance = jest.fn<Promise<{ allowanceParsed: string }>, [unknown]>();
const getAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
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

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      fetchTokenAllowance: (arg: unknown) => allowance(arg),
    },
    serviceAccount: {
      getAccount: (arg: unknown) => getAccount(arg),
      getAccountAddressForApi: async () => '0xowner',
    },
    serviceHistory: {
      getAccountLocalHistoryPendingTxs: (arg: unknown) => pendingTxs(arg),
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

  it('rechecks a previously clear allowance before starting an action', async () => {
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
    expect(result.current.status).toBe('required');
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
});
