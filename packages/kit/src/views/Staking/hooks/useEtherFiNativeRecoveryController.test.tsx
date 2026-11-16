/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockAccount = jest.fn<Promise<{ address: string }>, []>();
const mockBalances = jest.fn<Promise<unknown[]>, []>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({ Toast: { error: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: () => mockAccount() },
    serviceToken: { fetchTokensDetailsBatch: () => mockBalances() },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { etherFiDepositRecovery } from './etherFiDepositRecovery';
import { useEtherFiNativeRecoveryController } from './useEtherFiNativeDepositRecovery';

const account = '0x1111111111111111111111111111111111111111';
const scope = {
  accountId: 'account-1',
  accountAddress: account,
  networkId: 'evm--1',
  vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
};
const token = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  isNative: false,
  networkId: 'evm--1',
};
const asset: IEarnTokenItem = {
  info: token,
  balance: '1000000000000000000',
  balanceParsed: '1',
  fiatValue: '0',
  price: '1',
  price24h: '1',
};
const assets = [asset];
let nextTx = 0;
function retainedWrap() {
  const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
  const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
  if (!attempt) throw new OneKeyLocalError('Missing attempt');
  nextTx += 1;
  const txid = `0x${nextTx.toString(16).padStart(64, '0')}`;
  etherFiDepositRecovery.recordTxid(id, attempt, txid);
  etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
  etherFiDepositRecovery.detach(id, id);
  return id;
}

describe('EtherFi native recovery controller', () => {
  beforeEach(() => {
    mockAccount.mockReset().mockResolvedValue({ address: account });
    mockBalances
      .mockReset()
      .mockResolvedValue([{ accountAddress: account, tokens: [asset] }]);
  });

  it('releases the first claim when switching to a second retained operation', async () => {
    const first = retainedWrap();
    const second = retainedWrap();
    const setSelectedAsset = jest.fn();
    const hook = renderHook(() =>
      useEtherFiNativeRecoveryController({
        scope,
        assets,
        selectedAsset: asset,
        setSelectedAsset,
      }),
    );
    await act(async () => hook.result.current.resume(first));
    expect(hook.result.current.active?.id).toBe(first);
    await act(async () => hook.result.current.resume(second));
    expect(hook.result.current.active?.id).toBe(second);
    expect(etherFiDepositRecovery.get(first)?.detached).toBe(true);
    hook.unmount();
    expect(etherFiDepositRecovery.get(second)?.detached).toBe(true);
  });

  it('releases an old scope and does not restore its stale owner after switching back', async () => {
    const id = retainedWrap();
    const setSelectedAsset = jest.fn();
    const hook = renderHook(
      ({ currentScope }) =>
        useEtherFiNativeRecoveryController({
          scope: currentScope,
          assets,
          selectedAsset: asset,
          setSelectedAsset,
        }),
      { initialProps: { currentScope: scope } },
    );
    await act(async () => hook.result.current.resume(id));
    expect(hook.result.current.active?.id).toBe(id);
    hook.rerender({ currentScope: { ...scope, accountId: 'account-2' } });
    expect(hook.result.current.active).toBeUndefined();
    hook.rerender({ currentScope: scope });
    expect(hook.result.current.active).toBeUndefined();
    expect(etherFiDepositRecovery.get(id)?.detached).toBe(true);
  });

  it('lets the new scope proceed when an old balance request never settles', async () => {
    const first = retainedWrap();
    const second = retainedWrap();
    mockBalances.mockImplementationOnce(() => new Promise(() => undefined));
    const setSelectedAsset = jest.fn();
    const hook = renderHook(
      ({ currentScope }) =>
        useEtherFiNativeRecoveryController({
          scope: currentScope,
          assets,
          selectedAsset: asset,
          setSelectedAsset,
        }),
      { initialProps: { currentScope: scope } },
    );
    act(() => {
      void hook.result.current.resume(first);
    });
    await waitFor(() => expect(mockBalances).toHaveBeenCalledTimes(1));
    hook.rerender({ currentScope: { ...scope, accountId: 'account-2' } });
    hook.rerender({ currentScope: scope });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => hook.result.current.resume(second));
    expect(hook.result.current.active?.id).toBe(second);
    expect(etherFiDepositRecovery.get(first)?.detached).toBe(true);
  });
});
