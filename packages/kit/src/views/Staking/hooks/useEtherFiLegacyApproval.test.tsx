/** @jest-environment jsdom */
import { Suspense, startTransition, useLayoutEffect, useState } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';

import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useEtherFiLegacyApproval } from './useEtherFiLegacyApproval';

const allowance = jest.fn<Promise<{ allowanceParsed: string }>, [unknown]>();
const getAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const getAccountAddress = jest.fn<Promise<string>, [unknown]>();
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
      onSuccess: (
        data: Array<{
          signedTx?: { txid: string };
          decodedTx?: { txid: string };
        }>,
      ) => void;
      onCancel: () => void;
      onFail: (error: Error) => void;
      isNavigationCurrent?: () => boolean;
      onBeforeSend?: () => void | Promise<void>;
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
      getAccountAddressForApi: (arg: unknown) => getAccountAddress(arg),
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
  accountAddress: '0xowner',
  networkId: 'evm--1',
  provider: 'etherfi',
  vault,
};

function deferredStatus() {
  let resolve: (status: EOnChainHistoryTxStatus | undefined) => void = () =>
    undefined;
  const promise = new Promise<EOnChainHistoryTxStatus | undefined>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('EtherFi legacy allowance', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.resetAllMocks();
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    getAccount.mockResolvedValue({ address: '0xowner' });
    getAccountAddress.mockResolvedValue('0xowner');
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

  it('does not apply an old allowance after the same account changes address', async () => {
    let resolveOldAllowance: (result: {
      allowanceParsed: string;
    }) => void = () => undefined;
    allowance
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldAllowance = resolve;
        }),
      )
      .mockResolvedValue({ allowanceParsed: '1' });
    const { result, rerender } = renderHook(
      ({ accountAddress }) =>
        useEtherFiLegacyApproval({ ...params, accountAddress }),
      { initialProps: { accountAddress: '0xowner' } },
    );
    await waitFor(() => expect(allowance).toHaveBeenCalledTimes(1));
    expect(allowance).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xowner' }),
    );
    getAccountAddress.mockResolvedValue('0xother');
    rerender({ accountAddress: '0xother' });
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => resolveOldAllowance({ allowanceParsed: '0' }));
    expect(result.current.status).toBe('required');
  });

  it('rejects a prepared revoke when the account address changes before send', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    const confirmation = confirm.mock.calls[0][0];
    getAccount.mockResolvedValue({ address: '0xother' });
    await expect(confirmation.onBeforeSend?.()).rejects.toThrow(
      'Legacy approval account changed',
    );
  });

  it('keeps the guard blocked while the account address is unavailable', async () => {
    const initialProps: { accountAddress: string | undefined } = {
      accountAddress: undefined,
    };
    const { result, rerender } = renderHook(
      ({ accountAddress }: { accountAddress: string | undefined }) =>
        useEtherFiLegacyApproval({ ...params, accountAddress }),
      { initialProps },
    );
    await waitFor(() => expect(result.current.status).toBe('unknown'));
    expect(result.current.isActionAllowed()).toBe(false);
    expect(allowance).not.toHaveBeenCalled();
    rerender({ accountAddress: '0xowner' });
    await waitFor(() => expect(result.current.status).toBe('required'));
  });

  it('rejects send when the address changes during the final account lookup', async () => {
    const { result, rerender } = renderHook(
      ({ accountAddress }) =>
        useEtherFiLegacyApproval({ ...params, accountAddress }),
      { initialProps: { accountAddress: '0xowner' } },
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    let resolveAccount: (account: { address: string }) => void = () =>
      undefined;
    getAccount.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAccount = resolve;
      }),
    );
    const sending = confirm.mock.calls[0][0].onBeforeSend?.();
    getAccountAddress.mockResolvedValue('0xother');
    rerender({ accountAddress: '0xother' });
    resolveAccount({ address: '0xowner' });
    await expect(sending).rejects.toThrow('Legacy approval account changed');
  });

  it('ignores pending history returned for an earlier address', async () => {
    let resolveOldPending: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldPending = resolve;
        }),
      )
      .mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ accountAddress }) =>
        useEtherFiLegacyApproval({ ...params, accountAddress }),
      { initialProps: { accountAddress: '0xowner' } },
    );
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(1));
    getAccountAddress.mockResolvedValue('0xother');
    rerender({ accountAddress: '0xother' });
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => resolveOldPending([]));
    expect(result.current.status).toBe('required');
  });

  it.each(['ready', 'pending'] as const)(
    'keeps the committed account guard current when another account render suspends: %s',
    async (mode) => {
      let resolveAllowance: (result: {
        allowanceParsed: string;
      }) => void = () => undefined;
      if (mode === 'ready')
        allowance.mockResolvedValue({ allowanceParsed: '0' });
      else
        allowance.mockReturnValue(
          new Promise((resolve) => {
            resolveAllowance = resolve;
          }),
        );
      const never = new Promise<never>(() => undefined);
      let suspended = 0;
      let committed: ReturnType<typeof useEtherFiLegacyApproval> | undefined;
      function Guard({ accountId }: { accountId: string }) {
        const guard = useEtherFiLegacyApproval({ ...params, accountId });
        useLayoutEffect(() => {
          committed = guard;
        }, [guard]);
        return <span data-testid="legacy-status">{guard.status}</span>;
      }
      function Block({ active }: { active: boolean }) {
        if (active) {
          suspended += 1;
          throw never;
        }
        return null;
      }
      function App() {
        const [view, setView] = useState({
          accountId: 'account',
          suspend: false,
        });
        return (
          <>
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  setView({ accountId: 'other', suspend: true }),
                )
              }
            >
              Suspend other
            </button>
            <button
              type="button"
              onClick={() => setView({ accountId: 'account', suspend: false })}
            >
              Restore account
            </button>
            <Suspense fallback={<span>Suspended</span>}>
              <Guard accountId={view.accountId} />
              <Block active={view.suspend} />
            </Suspense>
          </>
        );
      }
      const screen = render(<App />);
      await waitFor(() => expect(allowance).toHaveBeenCalledTimes(1));
      if (mode === 'ready')
        await waitFor(() => expect(committed?.isActionAllowed()).toBe(true));
      fireEvent.click(screen.getByRole('button', { name: 'Suspend other' }));
      await waitFor(() => expect(suspended).toBeGreaterThan(0));
      expect(screen.queryByText('Suspended')).toBeNull();
      if (mode === 'ready') expect(committed?.isActionAllowed()).toBe(true);
      else {
        await act(async () => resolveAllowance({ allowanceParsed: '0' }));
        await waitFor(() => expect(committed?.isActionAllowed()).toBe(true));
      }
      fireEvent.click(screen.getByRole('button', { name: 'Restore account' }));
      expect(committed?.isActionAllowed()).toBe(true);
    },
  );

  it('does not open a revoke confirmation after the committed guard is hidden by Suspense', async () => {
    let finishRead: (result: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRead = resolve;
        }),
      )
      .mockResolvedValue({ allowanceParsed: '1' });
    const never = new Promise<never>(() => undefined);
    let committed: ReturnType<typeof useEtherFiLegacyApproval> | undefined;
    function Guard() {
      const guard = useEtherFiLegacyApproval(params);
      useLayoutEffect(() => {
        committed = guard;
      }, [guard]);
      return <span data-testid="legacy-status">{guard.status}</span>;
    }
    function Block({ active }: { active: boolean }) {
      if (active) throw never;
      return null;
    }
    function App() {
      const [hidden, setHidden] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setHidden(true)}>
            Hide guard
          </button>
          <button type="button" onClick={() => setHidden(false)}>
            Show guard
          </button>
          <Suspense fallback={<span>Suspended</span>}>
            <Guard />
            <Block active={hidden} />
          </Suspense>
        </>
      );
    }
    const screen = render(<App />);
    await waitFor(() => expect(committed?.status).toBe('required'));
    let revoke: Promise<void> | undefined;
    act(() => {
      revoke = committed?.revoke();
    });
    await waitFor(() => expect(allowance).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Hide guard' }));
    expect(screen.getByText('Suspended')).toBeTruthy();
    await act(async () => {
      finishRead({ allowanceParsed: '1' });
      await revoke;
    });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show guard' }));
    await waitFor(() => expect(committed?.status).toBe('unknown'));
    await act(async () => committed?.refresh());
    expect(committed?.status).toBe('required');
    await act(async () => committed?.revoke());
    expect(confirm).toHaveBeenCalledTimes(1);
    const first = confirm.mock.calls[0][0];
    expect(first.onBeforeSend).toEqual(expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'Hide guard' }));
    await expect(first.onBeforeSend?.()).rejects.toThrow();
    fireEvent.click(screen.getByRole('button', { name: 'Show guard' }));
    await waitFor(() => expect(committed?.status).toBe('unknown'));
    await expect(first.onBeforeSend?.()).rejects.toThrow();
    await act(async () => committed?.refresh());
    await act(async () => committed?.revoke());
    expect(confirm).toHaveBeenCalledTimes(2);
    const second = confirm.mock.calls[1][0];
    await expect(second.onBeforeSend?.()).resolves.toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide guard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show guard' }));
    await waitFor(() => expect(committed?.status).toBe('pending'));
    finalStatus.mockReturnValue(new Promise(() => {}));
    act(() => second.onSuccess([{ decodedTx: { txid: 'synthetic' } }]));
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'synthetic' }),
    );
  });

  it('skips other vaults and cancellation', () => {
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, vault: '0xother' }),
    );
    expect(result.current.blocked).toBe(false);
    expect(result.current.isActionAllowed()).toBe(true);
    expect(allowance).not.toHaveBeenCalled();
  });

  it('keeps unavailable or invalid allowance blocked', async () => {
    allowance.mockResolvedValue({ allowanceParsed: 'invalid' });
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('unknown'));
    expect(result.current.blocked).toBe(true);
  });

  it('blocks when a nonzero approval to the old queue is pending even if the allowance is currently zero', async () => {
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    finalStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.blocked).toBe(true);
  });

  it('does not clear the guard after a revoke confirms while another approval is pending', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValue({ allowanceParsed: '0' });
    const completion = deferredStatus();
    finalStatus.mockReturnValue(completion.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xrevoke' } }]),
    );
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    await act(async () => completion.resolve(EOnChainHistoryTxStatus.Success));
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('continues monitoring a second pending revoke after the first settles', async () => {
    const makePending = (txid: string) => ({
      decodedTx: {
        txid,
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
    });
    const first = deferredStatus();
    const second = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockResolvedValueOnce([makePending('0xsecond')])
      .mockResolvedValue([]);
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xfirst' }),
    );
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(finalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    expect(result.current.blocked).toBe(true);
    await act(async () => second.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('clear'));
  });

  it('does not let an older pending refresh clear a newer pending transaction', async () => {
    const makePending = (txid: string) => ({
      decodedTx: {
        txid,
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
    });
    let finishOldQuery: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const oldQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishOldQuery = resolve;
      },
    );
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockReturnValueOnce(oldQuery)
      .mockResolvedValue([makePending('0xsecond')]);
    txDetails
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Pending },
      })
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Success },
      })
      .mockResolvedValue({ data: { status: EOnChainHistoryTxStatus.Pending } });
    finalStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    let oldRefresh: Promise<void> | undefined;
    act(() => {
      oldRefresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(3));
    await act(async () => result.current.refresh());
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xsecond' }),
    );
    await act(async () => {
      finishOldQuery([]);
      await oldRefresh;
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('does not let a pending refresh clear a transaction discovered by the monitor', async () => {
    const makePending = (txid: string) => ({
      decodedTx: {
        txid,
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
    });
    let finishOldQuery: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const oldQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishOldQuery = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockReturnValueOnce(oldQuery)
      .mockResolvedValue([makePending('0xsecond')]);
    txDetails
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Pending },
      })
      .mockResolvedValue({ data: { status: EOnChainHistoryTxStatus.Success } });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    let oldRefresh: Promise<void> | undefined;
    act(() => {
      oldRefresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(3));
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(finalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    await act(async () => {
      finishOldQuery([]);
      await oldRefresh;
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('keeps a newly discovered approval when a monitor switches transactions during refresh', async () => {
    const pending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    let finishPending: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const pendingQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishPending = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([pending('0xfirst', '0')]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    pendingTxs
      .mockReturnValueOnce(pendingQuery)
      .mockResolvedValue([pending('0xsecond', '0')]);
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(2));
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(finalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    await act(async () => {
      finishPending([pending('0xnew', '10'), pending('0xsecond', '0')]);
      await refresh;
    });
    expect(result.current.status).toBe('pending');
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xnew' }),
    );
  });

  it('restarts a newly discovered monitor if it settles while refresh is in flight', async () => {
    const pending = (txid: string) => ({
      decodedTx: {
        txid,
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
    });
    let finishPending: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const pendingQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishPending = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([pending('0xfirst')]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    pendingTxs
      .mockReturnValueOnce(pendingQuery)
      .mockResolvedValueOnce([pending('0xsecond')])
      .mockResolvedValue([]);
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(2));
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(5));
    expect(result.current.status).toBe('pending');
    await act(async () => {
      finishPending([]);
      await refresh;
    });
    await waitFor(() => expect(result.current.status).toBe('clear'));
    expect(
      finalStatus.mock.calls.filter(
        ([arg]) =>
          typeof arg === 'object' &&
          arg !== null &&
          'txid' in arg &&
          arg.txid === '0xsecond',
      ),
    ).toHaveLength(2);
  });

  it('retains a confirmed increase when refresh discovers another transaction during reconciliation', async () => {
    const pending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    let finishHistory: (value: {
      data: { status: EOnChainHistoryTxStatus };
    }) => void = () => undefined;
    const history = new Promise<{ data: { status: EOnChainHistoryTxStatus } }>(
      (resolve) => {
        finishHistory = resolve;
      },
    );
    let phase: 'initial' | 'reconciling' | 'settled' = 'initial';
    txDetails.mockImplementation(async (arg) => {
      const txid =
        typeof arg === 'object' && arg !== null && 'txid' in arg
          ? arg.txid
          : undefined;
      if (txid === '0xsecond' && phase === 'reconciling') return history;
      if (txid === '0xsecond' && phase === 'settled')
        return { data: { status: EOnChainHistoryTxStatus.Success } };
      if (txid === '0xthird' && phase === 'settled')
        return { data: { status: EOnChainHistoryTxStatus.Failed } };
      return { data: { status: EOnChainHistoryTxStatus.Pending } };
    });
    const first = deferredStatus();
    const next = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      pending('0xfirst', '0'),
      pending('0xsecond', '10'),
    ]);
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    phase = 'reconciling';
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs.mockResolvedValue([]);
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(txDetails).toHaveBeenLastCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    pendingTxs
      .mockResolvedValueOnce([pending('0xnew', '0'), pending('0xthird', '10')])
      .mockResolvedValue([]);
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() =>
      expect(txDetails).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xthird' }),
      ),
    );
    phase = 'settled';
    await act(async () => {
      finishHistory({ data: { status: EOnChainHistoryTxStatus.Success } });
      await refresh;
    });
    await waitFor(() =>
      expect(finalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xnew' }),
      ),
    );
    await act(async () => next.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('required'));
  });

  it('retains a confirmed increase while refresh waits for the main revoke', async () => {
    const pending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    const first = deferredStatus();
    const resumed = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      pending('0xfirst', '0'),
      pending('0xsecond', '10'),
    ]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(resumed.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs.mockResolvedValue([]);
    txDetails.mockImplementation(async (arg) => ({
      data: {
        status:
          typeof arg === 'object' &&
          arg !== null &&
          'txid' in arg &&
          arg.txid === '0xsecond'
            ? EOnChainHistoryTxStatus.Success
            : EOnChainHistoryTxStatus.Pending,
      },
    }));
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(2));
    await act(async () => resumed.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('required'));
  });

  it('retains a confirmed increase when refresh overlaps its reconciliation', async () => {
    const pending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    let finishHistory: (value: {
      data: { status: EOnChainHistoryTxStatus };
    }) => void = () => undefined;
    const history = new Promise<{ data: { status: EOnChainHistoryTxStatus } }>(
      (resolve) => {
        finishHistory = resolve;
      },
    );
    let finishPending: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const pendingQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishPending = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      pending('0xfirst', '0'),
      pending('0xsecond', '10'),
    ]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs.mockResolvedValue([]);
    txDetails.mockReturnValue(history);
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(txDetails).toHaveBeenLastCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    pendingTxs.mockReturnValueOnce(pendingQuery).mockResolvedValue([]);
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(4));
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Success },
    });
    await act(async () =>
      finishHistory({ data: { status: EOnChainHistoryTxStatus.Success } }),
    );
    expect(result.current.status).toBe('pending');
    await act(async () => {
      finishPending([]);
      await refresh;
    });
    await waitFor(() => expect(result.current.status).toBe('required'));
  });

  it('does not let a settling monitor clear a newer in-flight refresh', async () => {
    const pending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    let finishHistory: (value: {
      data: { status: EOnChainHistoryTxStatus };
    }) => void = () => undefined;
    const history = new Promise<{ data: { status: EOnChainHistoryTxStatus } }>(
      (resolve) => {
        finishHistory = resolve;
      },
    );
    let finishPending: (
      value: Awaited<ReturnType<typeof pendingTxs>>,
    ) => void = () => undefined;
    const pendingQuery = new Promise<Awaited<ReturnType<typeof pendingTxs>>>(
      (resolve) => {
        finishPending = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      pending('0xfirst', '0'),
      pending('0xsecond', '10'),
    ]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
    pendingTxs.mockResolvedValue([]);
    txDetails.mockReturnValue(history);
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(txDetails).toHaveBeenLastCalledWith(
        expect.objectContaining({ txid: '0xsecond' }),
      ),
    );
    pendingTxs
      .mockReturnValueOnce(pendingQuery)
      .mockResolvedValue([pending('0xnew', '0')]);
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() => expect(pendingTxs).toHaveBeenCalledTimes(4));
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Pending },
    });
    await act(async () =>
      finishHistory({ data: { status: EOnChainHistoryTxStatus.Failed } }),
    );
    expect(result.current.status).toBe('pending');
    await act(async () => {
      finishPending([pending('0xnew', '0')]);
      await refresh;
    });
    expect(result.current.status).toBe('pending');
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xnew' }),
    );
  });

  it('preserves an unobserved approval increase when a refresh discovers a later revoke', async () => {
    const makePending = (txid: string, amount: string) => ({
      decodedTx: {
        txid,
        actions: [
          { tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount } },
        ],
      },
    });
    let finishDetails: (value: {
      data: { status: EOnChainHistoryTxStatus };
    }) => void = () => undefined;
    const details = new Promise<{ data: { status: EOnChainHistoryTxStatus } }>(
      (resolve) => {
        finishDetails = resolve;
      },
    );
    const first = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([makePending('0xincrease', '10')])
      .mockResolvedValueOnce([makePending('0xrevoke', '0')])
      .mockResolvedValue([]);
    txDetails
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Pending },
      })
      .mockReturnValueOnce(details);
    finalStatus
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    let refresh: Promise<void> | undefined;
    act(() => {
      refresh = result.current.refresh();
    });
    await waitFor(() => expect(txDetails).toHaveBeenCalledTimes(2));
    await act(async () => first.resolve(EOnChainHistoryTxStatus.Success));
    await act(async () => {
      finishDetails({ data: { status: EOnChainHistoryTxStatus.Success } });
      await refresh;
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('keeps monitoring a newly discovered pending transaction after details lookup fails', async () => {
    const makePending = (txid: string) => ({
      decodedTx: {
        txid,
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
    });
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([makePending('0xfirst')])
      .mockResolvedValue([makePending('0xsecond')]);
    txDetails
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Pending },
      })
      .mockRejectedValueOnce(new Error('History lookup unavailable'));
    finalStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xsecond' }),
    );
  });

  it('automatically requires revocation once a confirmed approval increase becomes visible', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs
      .mockResolvedValueOnce([
        {
          decodedTx: {
            txid: '0xincrease',
            actions: [
              {
                tokenApprove: {
                  spender: queue,
                  tokenIdOnNetwork: vault,
                  amount: '10',
                },
              },
            ],
          },
        },
      ])
      .mockResolvedValue([]);
    const completion = deferredStatus();
    finalStatus.mockReturnValue(completion.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => completion.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('required'));
    expect(result.current.blocked).toBe(true);
  });

  it('reconciles other confirmed increases before revoking the allowance', async () => {
    const pending = (txid: string) => ({
      decodedTx: {
        txid,
        actions: [
          {
            tokenApprove: {
              spender: queue,
              tokenIdOnNetwork: vault,
              amount: '10',
            },
          },
        ],
      },
    });
    const increase = deferredStatus();
    const revoke = deferredStatus();
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs
      .mockResolvedValueOnce([pending('0xfirst'), pending('0xsecond')])
      .mockResolvedValue([]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Success },
    });
    finalStatus
      .mockReturnValueOnce(increase.promise)
      .mockReturnValueOnce(revoke.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    allowance.mockResolvedValue({ allowanceParsed: '1' });
    await act(async () => increase.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xrevoke' } }]),
    );
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    await act(async () => revoke.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(result.current.status).toBe('clear'));
  });

  it('checks for new pending approvals after reading the cleared allowance', async () => {
    let finishAllowance: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockResolvedValueOnce({ allowanceParsed: '1' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishAllowance = resolve;
        }),
      );
    finalStatus
      .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success)
      .mockReturnValue(new Promise(() => {}));
    const onCleared = jest.fn();
    const { result } = renderHook(() =>
      useEtherFiLegacyApproval({ ...params, onCleared }),
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([{ signedTx: { txid: '0xrevoke' } }]),
    );
    await waitFor(() => expect(allowance).toHaveBeenCalledTimes(3));
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    await act(async () => finishAllowance({ allowanceParsed: '0' }));
    expect(result.current.status).toBe('pending');
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('treats any nonzero matching action as a possible allowance increase', async () => {
    allowance.mockResolvedValue({ allowanceParsed: '0' });
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
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    const completion = deferredStatus();
    finalStatus.mockReturnValue(completion.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => completion.resolve(EOnChainHistoryTxStatus.Success));
    expect(result.current.status).toBe('pending');
  });

  it('does not clear a confirmed nonzero approval before its allowance becomes visible', async () => {
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    const completion = deferredStatus();
    finalStatus.mockReturnValue(completion.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await act(async () => completion.resolve(EOnChainHistoryTxStatus.Success));
    pendingTxs.mockResolvedValue([]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Success },
    });
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
    allowance.mockResolvedValue({ allowanceParsed: '10' });
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('required');
  });

  it('keeps another matching approval blocked when the first has failed', async () => {
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xfailed',
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
      {
        decodedTx: {
          txid: '0xother',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Failed },
    });
    finalStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.blocked).toBe(true);
    expect(finalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0xother' }),
    );
  });

  it('keeps a confirmed increase unverified when a later pending revoke fails', async () => {
    allowance.mockResolvedValue({ allowanceParsed: '0' });
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xincrease',
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      },
    ]);
    const completion = deferredStatus();
    finalStatus.mockReturnValue(completion.promise);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    pendingTxs.mockResolvedValue([
      {
        decodedTx: {
          txid: '0xrevoke',
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
    await act(async () => completion.resolve(EOnChainHistoryTxStatus.Success));
    txDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Failed },
    });
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('pending');
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

  it('blocks without opening a revoke confirmation when interactive revocation is disabled', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    let allowed = true;
    await act(async () => {
      allowed = await result.current.verifyBeforeAction({ allowRevoke: false });
    });
    expect(allowed).toBe(false);
    expect(result.current.status).toBe('required');
    expect(result.current.blocked).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    await act(async () => result.current.revoke());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0].approvesInfo[0]).toMatchObject({
      spender: queue,
      amount: '0',
    });
  });

  it('updates action permission synchronously around verification', async () => {
    let finishAllowance: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishAllowance = resolve;
        }),
      );
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    expect(result.current.isActionAllowed()).toBe(true);
    let verification: Promise<boolean> | undefined;
    act(() => {
      verification = result.current.verifyBeforeAction({ allowRevoke: false });
      expect(result.current.isActionAllowed()).toBe(false);
    });
    await act(async () => {
      finishAllowance({ allowanceParsed: '0' });
      expect(await verification).toBe(true);
      expect(result.current.isActionAllowed()).toBe(true);
    });
  });

  it('keeps an older verification blocked when a new refresh starts', async () => {
    let finishVerification: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    let finishRefresh: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishVerification = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
      );
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('clear'));
    let verification: Promise<boolean> | undefined;
    let refresh: Promise<void> | undefined;
    act(() => {
      verification = result.current.verifyBeforeAction({ allowRevoke: false });
      refresh = result.current.refresh();
      expect(result.current.isActionAllowed()).toBe(false);
    });
    await act(async () => {
      finishVerification({ allowanceParsed: '0' });
      expect(await verification).toBe(false);
      expect(result.current.isActionAllowed()).toBe(false);
      finishRefresh({ allowanceParsed: '0' });
      await refresh;
      expect(result.current.isActionAllowed()).toBe(true);
    });
  });

  it('immediately invalidates permission for an earlier account scope', async () => {
    let finishNew: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishNew = resolve;
        }),
      );
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiLegacyApproval(value),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('clear'));
    const oldPermission = result.current.isActionAllowed;
    rerender({ ...params, accountId: 'other' });
    expect(oldPermission()).toBe(false);
    expect(result.current.isActionAllowed()).toBe(false);
    await act(async () => finishNew({ allowanceParsed: '0' }));
    expect(result.current.isActionAllowed()).toBe(true);
    expect(oldPermission()).toBe(false);
  });

  it('requires a fresh allowance result after switching away and back', async () => {
    let finishReturn: (value: { allowanceParsed: string }) => void = () =>
      undefined;
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishReturn = resolve;
        }),
      );
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiLegacyApproval(value),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('clear'));
    const oldPermission = result.current.isActionAllowed;
    rerender({ ...params, accountId: 'other' });
    await waitFor(() => expect(result.current.status).toBe('clear'));
    rerender(params);
    expect(result.current.status).toBe('checking');
    expect(result.current.isActionAllowed()).toBe(false);
    expect(oldPermission()).toBe(false);
    await act(async () => finishReturn({ allowanceParsed: '0' }));
    expect(result.current.isActionAllowed()).toBe(true);
    expect(oldPermission()).toBe(false);
  });

  it('monitors a pending revoke discovered during the final allowance check', async () => {
    allowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '1' });
    pendingTxs.mockResolvedValueOnce([]).mockResolvedValue([
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

  it('allows rechecking a failed signing attempt without treating it as a submitted transaction', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    await act(async () => {
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new UserCancel());
    });
    expect(result.current.status).toBe('unknown');
    act(() => confirm.mock.calls[0][0].onCancel());
    expect(result.current.status).toBe('unknown');
    expect(result.current.blocked).toBe(true);
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('required');
    await act(async () => result.current.revoke());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('keeps an uncertain earlier send blocked when a retry is rejected on the device', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    await act(async () => {
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new Error('RPC response lost'));
    });
    expect(result.current.status).toBe('pending');
    await act(async () => {
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new UserCancel());
      confirm.mock.calls[0][0].onCancel();
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.blocked).toBe(true);
  });

  it('recovers after repeated device rejections when no attempt reached broadcasting', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    await act(async () => {
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new UserCancel());
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new UserCancel());
      confirm.mock.calls[0][0].onCancel();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('required');
  });

  it('does not treat a preparation failure after a device rejection as a broadcast', async () => {
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    await act(async () => {
      await confirm.mock.calls[0][0].onBeforeSend?.();
      confirm.mock.calls[0][0].onFail(new UserCancel());
      confirm.mock.calls[0][0].onFail(new Error('Fee preparation failed'));
      confirm.mock.calls[0][0].onCancel();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => result.current.refresh());
    expect(result.current.status).toBe('required');
  });

  it.each([
    { linked: true, final: EOnChainHistoryTxStatus.Success, expected: 'clear' },
    {
      linked: true,
      final: EOnChainHistoryTxStatus.Success,
      expected: 'pending',
      otherIncrease: true,
    },
    {
      linked: true,
      final: EOnChainHistoryTxStatus.Success,
      expected: 'clear',
      otherIncrease: true,
      otherFailed: true,
    },
    {
      linked: true,
      final: EOnChainHistoryTxStatus.Success,
      expected: 'clear',
      otherIncrease: true,
      otherCanceled: true,
    },
    {
      linked: true,
      final: EOnChainHistoryTxStatus.Success,
      expected: 'required',
      otherIncrease: true,
      otherSpeedUp: true,
    },
    {
      linked: false,
      final: EOnChainHistoryTxStatus.Success,
      expected: 'pending',
    },
    {
      linked: true,
      final: EOnChainHistoryTxStatus.Failed,
      expected: 'clear',
    },
  ] as const)(
    'only clears an increase after its linked cancellation settles: %o',
    async (testCase) => {
      const { linked, final, expected } = testCase;
      const pending = (txid: string, cancel = false) => ({
        ...(cancel ? { replacedType: EReplaceTxType.Cancel } : {}),
        decodedTx: {
          txid,
          actions: [
            {
              tokenApprove: {
                spender: queue,
                tokenIdOnNetwork: vault,
                amount: '10',
              },
            },
          ],
        },
      });
      const original = deferredStatus();
      const cancellation = deferredStatus();
      allowance.mockResolvedValue({ allowanceParsed: '0' });
      pendingTxs.mockResolvedValue([
        pending('0xoriginal'),
        ...('otherIncrease' in testCase && testCase.otherIncrease
          ? [pending('0xother')]
          : []),
      ]);
      txDetails.mockResolvedValue({
        data: { status: EOnChainHistoryTxStatus.Pending },
      });
      finalStatus
        .mockReturnValueOnce(original.promise)
        .mockReturnValueOnce(cancellation.promise);
      localHistoryTx.mockImplementation(async ({ historyId }) => {
        if (linked && historyId === 'evm--1_0xoriginal_0xowner_')
          return {
            id: historyId,
            replacedNextId: 'cancel',
            decodedTx: { txid: '0xoriginal' },
          };
        if (linked && historyId === 'cancel')
          return {
            id: historyId,
            replacedType: EReplaceTxType.Cancel,
            decodedTx: { txid: '0xcancel' },
          };
        if (
          (('otherCanceled' in testCase && testCase.otherCanceled) ||
            ('otherSpeedUp' in testCase && testCase.otherSpeedUp)) &&
          historyId === 'evm--1_0xother_0xowner_'
        )
          return {
            id: historyId,
            replacedNextId: 'othercancel',
            decodedTx: { txid: '0xother' },
          };
        if (
          (('otherCanceled' in testCase && testCase.otherCanceled) ||
            ('otherSpeedUp' in testCase && testCase.otherSpeedUp)) &&
          historyId === 'othercancel'
        )
          return {
            id: historyId,
            replacedType:
              'otherSpeedUp' in testCase && testCase.otherSpeedUp
                ? EReplaceTxType.SpeedUp
                : EReplaceTxType.Cancel,
            decodedTx: { txid: '0xothercancel' },
          };
        return undefined;
      });
      const { result } = renderHook(() => useEtherFiLegacyApproval(params));
      await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
      pendingTxs.mockResolvedValue([pending('0xcancel', true)]);
      await act(async () => result.current.refresh());
      await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(2));
      pendingTxs.mockResolvedValue([]);
      if ('otherSpeedUp' in testCase && testCase.otherSpeedUp)
        allowance.mockResolvedValue({ allowanceParsed: '1' });
      txDetails.mockImplementation(async (arg) => {
        const isOther =
          typeof arg === 'object' &&
          arg !== null &&
          'txid' in arg &&
          arg.txid === '0xother';
        if (
          isOther &&
          (('otherCanceled' in testCase && testCase.otherCanceled) ||
            ('otherSpeedUp' in testCase && testCase.otherSpeedUp))
        )
          return { data: { status: EOnChainHistoryTxStatus.Pending } };
        if (isOther && 'otherFailed' in testCase && testCase.otherFailed)
          return { data: { status: EOnChainHistoryTxStatus.Failed } };
        return { data: { status: final } };
      });
      await act(async () => cancellation.resolve(final));
      await waitFor(() => expect(result.current.status).toBe(expected));
      expect(result.current.blocked).toBe(expected !== 'clear');
    },
  );

  it.each([
    ['cancel', 'failed'],
    ['revoke', 'failed'],
    ['cancel', 'success'],
    ['revoke', 'success'],
    ['cancel', 'unknown'],
    ['revoke', 'unknown'],
    ['cancel', 'unmount'],
    ['revoke', 'unmount'],
    ['revoke', 'stale'],
    ['revoke', 'mixed'],
    ['cancel', 'pendingNonzero'],
    ['revoke', 'pendingNonzero'],
  ] as const)(
    'rechecks a second approval after the first %s settles: %s',
    async (kind, outcome) => {
      const pending = (txid: string, amount: string, cancel = false) => ({
        ...(cancel ? { replacedType: EReplaceTxType.Cancel } : {}),
        decodedTx: {
          txid,
          actions: [
            {
              tokenApprove: { spender: queue, tokenIdOnNetwork: vault, amount },
            },
          ],
        },
      });
      let nextTick: () => void = () => undefined;
      const wait = jest.spyOn(timerUtils, 'wait').mockImplementation(() =>
        outcome === 'unknown'
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              nextTick = resolve;
            }),
      );
      const first = deferredStatus();
      const cancellation = deferredStatus();
      allowance.mockResolvedValue({ allowanceParsed: '0' });
      pendingTxs.mockResolvedValue([
        pending('0xfirst', kind === 'cancel' ? '10' : '0'),
        pending('0xsecond', '10'),
        ...(outcome === 'mixed' ? [pending('0xthird', '10')] : []),
      ]);
      txDetails.mockResolvedValue({
        data: { status: EOnChainHistoryTxStatus.Pending },
      });
      finalStatus
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(cancellation.promise);
      localHistoryTx.mockImplementation(async ({ historyId }) => {
        if (historyId === 'evm--1_0xfirst_0xowner_')
          return {
            id: historyId,
            replacedNextId: 'cancel',
            decodedTx: { txid: '0xfirst' },
          };
        if (historyId === 'cancel')
          return {
            id: historyId,
            replacedType: EReplaceTxType.Cancel,
            decodedTx: { txid: '0xcancel' },
          };
        return undefined;
      });
      const { result, unmount } = renderHook(() =>
        useEtherFiLegacyApproval(params),
      );
      await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(1));
      if (kind === 'cancel') {
        pendingTxs.mockResolvedValue([pending('0xcancel', '10', true)]);
        await act(async () => result.current.refresh());
        await waitFor(() => expect(finalStatus).toHaveBeenCalledTimes(2));
      }
      pendingTxs.mockResolvedValue([]);
      await act(async () =>
        (kind === 'cancel' ? cancellation : first).resolve(
          EOnChainHistoryTxStatus.Success,
        ),
      );
      expect(result.current.status).toBe('pending');
      if (outcome === 'unknown') {
        await waitFor(() => expect(wait).toHaveBeenCalledTimes(14));
        expect(result.current.blocked).toBe(true);
        return;
      }
      await waitFor(() => expect(wait).toHaveBeenCalled());
      if (outcome === 'unmount') {
        unmount();
        txDetails.mockClear();
        await act(async () => nextTick());
        expect(txDetails).not.toHaveBeenCalled();
        return;
      }
      if (
        outcome === 'success' ||
        outcome === 'stale' ||
        outcome === 'mixed' ||
        outcome === 'pendingNonzero'
      )
        allowance.mockResolvedValue({ allowanceParsed: '1' });
      if (outcome === 'mixed') {
        txDetails.mockImplementation(async (arg) => ({
          data: {
            status:
              typeof arg === 'object' &&
              arg !== null &&
              'txid' in arg &&
              arg.txid === '0xsecond'
                ? EOnChainHistoryTxStatus.Success
                : EOnChainHistoryTxStatus.Pending,
          },
        }));
      } else if (outcome !== 'pendingNonzero') {
        txDetails.mockResolvedValue({
          data: {
            status:
              outcome === 'success'
                ? EOnChainHistoryTxStatus.Success
                : EOnChainHistoryTxStatus.Failed,
          },
        });
      }
      await act(async () => nextTick());
      if (outcome === 'pendingNonzero') {
        expect(result.current.status).toBe('pending');
        await act(async () => result.current.revoke());
        expect(confirm).not.toHaveBeenCalled();
        await waitFor(() => expect(wait).toHaveBeenCalledTimes(2));
        allowance.mockResolvedValue({ allowanceParsed: '0' });
        txDetails.mockResolvedValue({
          data: { status: EOnChainHistoryTxStatus.Failed },
        });
        await act(async () => nextTick());
      }
      if (outcome === 'mixed') {
        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(wait).toHaveBeenCalledTimes(2));
        txDetails.mockImplementation(async (arg) => ({
          data: {
            status:
              typeof arg === 'object' &&
              arg !== null &&
              'txid' in arg &&
              arg.txid === '0xsecond'
                ? EOnChainHistoryTxStatus.Success
                : EOnChainHistoryTxStatus.Failed,
          },
        }));
        await act(async () => nextTick());
      }
      if (outcome === 'stale') {
        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(wait).toHaveBeenCalledTimes(2));
        allowance.mockResolvedValue({ allowanceParsed: '0' });
        await act(async () => nextTick());
      }
      await waitFor(() =>
        expect(result.current.status).toBe(
          outcome === 'success' || outcome === 'mixed' ? 'required' : 'clear',
        ),
      );
    },
  );

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

  it.each(['missing', 'known'] as const)(
    'keeps a %s revoke transaction pending when the observed allowance becomes zero before confirmation',
    async (txid) => {
      finalStatus.mockReturnValue(new Promise(() => {}));
      txDetails.mockResolvedValue({
        data: { status: EOnChainHistoryTxStatus.Pending },
      });
      const { result } = renderHook(() => useEtherFiLegacyApproval(params));
      await waitFor(() => expect(result.current.status).toBe('required'));
      await act(async () => result.current.revoke());
      act(() =>
        confirm.mock.calls[0][0].onSuccess(
          txid === 'known' ? [{ signedTx: { txid: '0xrevoke' } }] : [],
        ),
      );
      expect(result.current.status).toBe('pending');
      allowance.mockResolvedValue({ allowanceParsed: '0' });
      await act(async () => result.current.refresh());
      expect(result.current.status).toBe('pending');
      expect(result.current.blocked).toBe(true);
    },
  );

  it('uses the decoded transaction id when the signed id is blank', async () => {
    finalStatus.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEtherFiLegacyApproval(params));
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    act(() =>
      confirm.mock.calls[0][0].onSuccess([
        { signedTx: { txid: ' ' }, decodedTx: { txid: '0xdecoded' } },
      ]),
    );
    await waitFor(() =>
      expect(finalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xdecoded' }),
      ),
    );
    expect(result.current.status).toBe('pending');
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

  it('invalidates a prepared revoke confirmation when the account changes', async () => {
    const { result, rerender } = renderHook(
      (p: typeof params) => useEtherFiLegacyApproval(p),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    const isNavigationCurrent = confirm.mock.calls[0][0].isNavigationCurrent;
    expect(isNavigationCurrent?.()).toBe(true);
    rerender({ ...params, accountId: 'other' });
    expect(isNavigationCurrent?.()).toBe(false);
  });

  it('invalidates a prepared revoke confirmation after unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useEtherFiLegacyApproval(params),
    );
    await waitFor(() => expect(result.current.status).toBe('required'));
    await act(async () => result.current.revoke());
    const isNavigationCurrent = confirm.mock.calls[0][0].isNavigationCurrent;
    expect(isNavigationCurrent?.()).toBe(true);
    unmount();
    expect(isNavigationCurrent?.()).toBe(false);
  });
});
