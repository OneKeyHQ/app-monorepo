/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';
import { createStore } from 'jotai';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  ProviderJotaiContextSignatureConfirm,
  decodedTxsAtom,
  decodedTxsInitAtom,
  unsignedTxsAtom,
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

function Review() {
  const [txs] = useUnsignedTxsAtom();
  useTxConfirmDecodedTxs({
    accountId: txs[0].accountId ?? '',
    networkId: txs[0].networkId ?? '',
    unsignedTxs: txs,
  });
  return null;
}

it('binds the route before decoding and ignores old completions after a queue switch or edit', async () => {
  const store = createStore();
  store.set(unsignedTxsAtom(), [btc]);
  store.set(decodedTxsAtom(), {
    decodedTxs: [decoded(btc)],
    isBuildingDecodedTxs: false,
  });
  store.set(decodedTxsInitAtom(), true);
  const pending = Promise.withResolvers<IDecodedTx[]>();
  service.buildDecodedTxs.mockReturnValueOnce(pending.promise);
  render(
    <ProviderJotaiContextSignatureConfirm store={store}>
      <TxConfirmState unsignedTxs={[sui]}>
        <Review />
      </TxConfirmState>
    </ProviderJotaiContextSignatureConfirm>,
  );
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
  const store = createStore();
  const pending = Promise.withResolvers<IDecodedTx[]>();
  service.buildDecodedTxs
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce([decoded(sui)]);
  const open = (tx: typeof sui) =>
    render(
      <ProviderJotaiContextSignatureConfirm store={store}>
        <TxConfirmState unsignedTxs={[tx]}>
          <Review />
        </TxConfirmState>
      </ProviderJotaiContextSignatureConfirm>,
    );
  open(btc).unmount();
  await act(async () => {
    open(sui);
  });
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([decoded(sui)]);
  await act(async () => {
    pending.resolve([decoded(btc)]);
  });
  expect(store.get(decodedTxsAtom()).decodedTxs).toEqual([decoded(sui)]);
  expect(store.get(decodedTxsInitAtom())).toBe(true);
});
