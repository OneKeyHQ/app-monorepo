/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/states/jotai/contexts/signatureConfirm/actions.gasAccountSubmitResultUnknown.test.tsx

OK-64746: when a Gas Account send fails with a result-unknown code the tx
may already be on chain. The confirm page latches that outcome per tx so
neither the estimate poll nor a second confirm tap can move on to a new
nonce / quote and send a second tx. The latch lives outside the quote state
that every estimate round resets, and it is keyed by the tx uuid so queue
navigation to another tx and back cannot unlock the attempted one.
*/
import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { useSignatureConfirmActions } from './actions';
import {
  ProviderJotaiContextSignatureConfirm,
  useGasAccountUiStateAtom,
  useIsGasAccountSubmitResultUnknown,
} from './atoms';

function createWrapper() {
  const store = createStore();
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSignatureConfirm store={store}>
        {children}
      </ProviderJotaiContextSignatureConfirm>
    );
  };
}

function renderConfirmState(initialTxUuid: string | undefined) {
  return renderHook(
    (txUuid: string | undefined) => {
      const actions = useSignatureConfirmActions().current;
      const latched = useIsGasAccountSubmitResultUnknown(txUuid);
      const [gasAccountUiState] = useGasAccountUiStateAtom();
      return { actions, latched, gasAccountUiState };
    },
    { wrapper: createWrapper(), initialProps: initialTxUuid },
  );
}

describe('gas account submit result-unknown latch', () => {
  it('is off until a result-unknown send failure marks the tx', () => {
    const { result, rerender } = renderConfirmState('tx-a');
    expect(result.current.latched).toBe(false);

    act(() => {
      result.current.actions.markGasAccountSubmitResultUnknown('tx-a');
    });

    expect(result.current.latched).toBe(true);
    rerender('tx-b');
    expect(result.current.latched).toBe(false);
  });

  it('survives the quote-state reset an estimate round performs', () => {
    const { result } = renderConfirmState('tx-a');
    act(() => {
      result.current.actions.updateGasAccountUiState({
        payer: 'gasAccount',
        selectedPayer: 'gasAccount',
        lockedUserNonce: 7,
        idempotencyKey: 'ga:quote-1',
      });
      result.current.actions.markGasAccountSubmitResultUnknown('tx-a');
    });

    act(() => {
      result.current.actions.resetGasAccountUiState();
    });

    expect(result.current.gasAccountUiState.lockedUserNonce).toBeUndefined();
    expect(result.current.latched).toBe(true);
  });

  it('keeps the latch for a tx while the page shows another queued tx', () => {
    const { result, rerender } = renderConfirmState('tx-a');
    act(() => {
      result.current.actions.markGasAccountSubmitResultUnknown('tx-a');
    });

    // Queue navigation switches the page to tx-b, which resets the fee
    // state, then comes back to tx-a.
    rerender('tx-b');
    act(() => {
      result.current.actions.resetTxFeeState();
    });
    expect(result.current.latched).toBe(false);

    rerender('tx-a');
    expect(result.current.latched).toBe(true);
  });

  it('falls back to a page-wide key for a tx without uuid', () => {
    const { result, rerender } = renderConfirmState(undefined);
    act(() => {
      result.current.actions.markGasAccountSubmitResultUnknown(undefined);
    });

    expect(result.current.latched).toBe(true);
    rerender('tx-a');
    expect(result.current.latched).toBe(false);
  });
});
