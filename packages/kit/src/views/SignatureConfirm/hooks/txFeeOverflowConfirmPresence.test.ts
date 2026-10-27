/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  isTxFeeOverflowConfirmOpen,
  markTxFeeOverflowConfirmOpen,
  subscribeTxFeeOverflowConfirmPresence,
  useIsTxFeeOverflowConfirmOpen,
} from './txFeeOverflowConfirmPresence';

describe('txFeeOverflowConfirmPresence', () => {
  it('is closed until a dialog opens, and closed again once it settles', () => {
    expect(isTxFeeOverflowConfirmOpen()).toBe(false);
    const markClosed = markTxFeeOverflowConfirmOpen();
    expect(isTxFeeOverflowConfirmOpen()).toBe(true);
    markClosed();
    expect(isTxFeeOverflowConfirmOpen()).toBe(false);
  });

  it('tolerates the close mark firing twice (button + onClose)', () => {
    const markClosed = markTxFeeOverflowConfirmOpen();
    markClosed();
    markClosed();
    expect(isTxFeeOverflowConfirmOpen()).toBe(false);
    // the count did not go negative: a later open still reads as open
    const markClosedAgain = markTxFeeOverflowConfirmOpen();
    expect(isTxFeeOverflowConfirmOpen()).toBe(true);
    markClosedAgain();
  });

  it('stays open while any of two overlapping dialogs is still up', () => {
    const closeFirst = markTxFeeOverflowConfirmOpen();
    const closeSecond = markTxFeeOverflowConfirmOpen();
    closeFirst();
    expect(isTxFeeOverflowConfirmOpen()).toBe(true);
    closeSecond();
    expect(isTxFeeOverflowConfirmOpen()).toBe(false);
  });

  it('notifies subscribers on open and on close, and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTxFeeOverflowConfirmPresence(listener);
    const markClosed = markTxFeeOverflowConfirmOpen();
    expect(listener).toHaveBeenCalledTimes(1);
    markClosed();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    const markClosedAgain = markTxFeeOverflowConfirmOpen();
    markClosedAgain();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('drives the hook through the open/close cycle', () => {
    const { result } = renderHook(() => useIsTxFeeOverflowConfirmOpen());
    expect(result.current).toBe(false);
    let markClosed: (() => void) | undefined;
    act(() => {
      markClosed = markTxFeeOverflowConfirmOpen();
    });
    expect(result.current).toBe(true);
    act(() => {
      markClosed?.();
    });
    expect(result.current).toBe(false);
  });
});
