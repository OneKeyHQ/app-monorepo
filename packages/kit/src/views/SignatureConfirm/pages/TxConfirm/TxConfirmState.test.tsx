/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  decodedTxsAtom,
  decodedTxsInitAtom,
  unsignedTxsAtom,
  useSignatureConfirmContextData,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { EDecodedTxStatus, type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { TxConfirmState, useTxConfirmDecodedTxs } from './TxConfirmState';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceSignatureConfirm: { buildDecodedTxs: jest.fn() } },
}));
jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboard: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({}),
}));

const service = jest.mocked(backgroundApiProxy.serviceSignatureConfirm);
const btc = { accountId: 'first', networkId: 'btc--0', encodedTx: 'btc' };
const sui = {
  accountId: 'second',
  networkId: 'sui--mainnet',
  encodedTx: 'sui',
};
function decoded(tx: typeof sui): IDecodedTx {
  return {
    ...tx,
    txid: '',
    owner: '',
    signer: '',
    actions: [],
    status: EDecodedTxStatus.Pending,
    extraInfo: null,
  };
}

function useReview() {
  const [txs] = useUnsignedTxsAtom();
  useTxConfirmDecodedTxs({
    accountId: txs[0].accountId ?? '',
    networkId: txs[0].networkId ?? '',
    unsignedTxs: txs,
  });
  const { store } = useSignatureConfirmContextData();
  return store!;
}

function openReview(tx: typeof sui) {
  const unsignedTxs = [tx];
  return renderHook(useReview, {
    wrapper: ({ children }: PropsWithChildren) => (
      <TxConfirmState unsignedTxs={unsignedTxs}>{children}</TxConfirmState>
    ),
  });
}

it('binds the route before decoding and ignores old completions after a queue switch or edit', async () => {
  const pending = Promise.withResolvers<IDecodedTx[]>();
  service.buildDecodedTxs.mockReturnValueOnce(pending.promise);
  const store = openReview(sui).result.current;
  expect(service.buildDecodedTxs.mock.calls.map(([p]) => p.networkId)).toEqual([
    sui.networkId,
  ]);
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([]);
  expect(store.get(decodedTxsInitAtom())).toBe(false);

  const next = { ...btc, uuid: 'queue-item' };
  const edit = { ...next, encodedTx: 'edited' };
  const queued = Promise.withResolvers<IDecodedTx[]>();
  service.buildDecodedTxs
    .mockReturnValueOnce(queued.promise)
    .mockResolvedValueOnce([decoded(edit)]);
  act(() => store.set(unsignedTxsAtom(), [next]));
  await act(async () => store.set(unsignedTxsAtom(), [edit]));
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([decoded(edit)]);
  await act(async () => {
    queued.resolve([decoded(next)]);
    pending.resolve([decoded(sui)]);
  });
  expect(store.get(unsignedTxsAtom())).toEqual([edit]);
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([decoded(edit)]);
  expect(store.get(decodedTxsInitAtom())).toBe(true);
});

it('keeps the Sui review when BTC resolves after its page was closed', async () => {
  const pending = Promise.withResolvers<IDecodedTx[]>();
  service.buildDecodedTxs
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce([decoded(sui)]);
  openReview(btc).unmount();
  const { result } = openReview(sui);
  await act(async () => pending.resolve([decoded(btc)]));
  const store = result.current;
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([decoded(sui)]);
  expect(store.get(decodedTxsInitAtom())).toBe(true);
});

it('keeps stacked BTC reviews and their edits in their originating route', async () => {
  const second = { ...btc, encodedTx: 'second row' };
  const edited = { ...second, encodedTx: 'edited second row' };
  service.buildDecodedTxs.mockImplementation(async ({ unsignedTxs }) => [
    decoded({ ...btc, encodedTx: String(unsignedTxs[0].encodedTx) }),
  ]);
  const first = openReview(btc);
  const top = openReview(second);
  await act(async () => top.result.current.set(unsignedTxsAtom(), [edited]));
  expect(top.result.current.get(decodedTxsAtom()).decodedTxs).toEqual([
    decoded(edited),
  ]);
  top.unmount();
  expect(first.result.current.get(unsignedTxsAtom())).toEqual([btc]);
  expect(first.result.current.get(decodedTxsAtom()).decodedTxs).toEqual([
    decoded(btc),
  ]);
  expect(first.result.current.get(decodedTxsInitAtom())).toBe(true);
});
