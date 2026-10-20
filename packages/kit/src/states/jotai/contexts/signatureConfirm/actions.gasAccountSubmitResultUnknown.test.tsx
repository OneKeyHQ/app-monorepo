/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/states/jotai/contexts/signatureConfirm/actions.gasAccountSubmitResultUnknown.test.tsx

OK-64746: when a Gas Account send fails with a result-unknown code the tx
may already be on chain. The confirm page latches that outcome for the rest
of the page so neither the estimate poll nor a second confirm tap can move
on to a new nonce / quote and send a second tx. The latch therefore lives
outside the quote state that every estimate round resets; only a new tx on
the page clears it.
*/
import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { useSignatureConfirmActions } from './actions';
import {
  ProviderJotaiContextSignatureConfirm,
  useGasAccountSubmitResultUnknownAtom,
  useGasAccountUiStateAtom,
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

function renderConfirmState() {
  return renderHook(
    () => {
      const actions = useSignatureConfirmActions().current;
      const [submitResultUnknown] = useGasAccountSubmitResultUnknownAtom();
      const [gasAccountUiState] = useGasAccountUiStateAtom();
      return { actions, submitResultUnknown, gasAccountUiState };
    },
    { wrapper: createWrapper() },
  );
}

describe('gas account submit result-unknown latch', () => {
  it('is off until a result-unknown send failure sets it', () => {
    const { result } = renderConfirmState();
    expect(result.current.submitResultUnknown).toBe(false);

    act(() => {
      result.current.actions.updateGasAccountSubmitResultUnknown(true);
    });

    expect(result.current.submitResultUnknown).toBe(true);
  });

  it('survives the quote-state reset an estimate round performs', () => {
    const { result } = renderConfirmState();
    act(() => {
      result.current.actions.updateGasAccountUiState({
        payer: 'gasAccount',
        selectedPayer: 'gasAccount',
        lockedUserNonce: 7,
        idempotencyKey: 'ga:quote-1',
      });
      result.current.actions.updateGasAccountSubmitResultUnknown(true);
    });

    act(() => {
      result.current.actions.resetGasAccountUiState();
    });

    expect(result.current.gasAccountUiState.lockedUserNonce).toBeUndefined();
    expect(result.current.submitResultUnknown).toBe(true);
  });

  it('clears when the page moves on to a new tx', () => {
    const { result } = renderConfirmState();
    act(() => {
      result.current.actions.updateGasAccountSubmitResultUnknown(true);
    });

    act(() => {
      result.current.actions.resetTxFeeState();
    });

    expect(result.current.submitResultUnknown).toBe(false);
  });
});
