import { useSyncExternalStore } from 'react';

/**
 * Module-level store for the WalletConnect Pay dialog host. The dialog is a
 * global overlay, not a navigation route, so entry points (QR parse, deep
 * link) write here and the container in provider/Container renders from it.
 * State (not an event) on purpose: a deep link drained before the container
 * mounts is not lost — the container reads the current state on mount.
 *
 * `isHidden` parks the dialog while a sub-flow owns the screen (compliance
 * form route, TxConfirm fallback) and MUST NOT end the flow: the flow
 * component stays mounted, so its in-flight attempt (and its cancellation
 * semantics) survive. Only `isOpen: false` unmounts the flow.
 */
export interface IWcPayDialogState {
  isOpen: boolean;
  isHidden: boolean;
  paymentLink: string;
  /** Remount key: a new open() means a brand-new flow instance. */
  instanceId: number;
}

const initialState: IWcPayDialogState = {
  isOpen: false,
  isHidden: false,
  paymentLink: '',
  instanceId: 0,
};

let state: IWcPayDialogState = initialState;
let nextInstanceId = 1;
const listeners = new Set<() => void>();

function setState(next: IWcPayDialogState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getWcPayDialogState(): IWcPayDialogState {
  return state;
}

export function subscribeWcPayDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openWcPayDialog({ paymentLink }: { paymentLink: string }) {
  const instanceId = nextInstanceId;
  nextInstanceId += 1;
  setState({ isOpen: true, isHidden: false, paymentLink, instanceId });
}

export function closeWcPayDialog() {
  setState({ ...initialState });
}

export function hideWcPayDialog() {
  if (!state.isOpen || state.isHidden) return;
  setState({ ...state, isHidden: true });
}

export function revealWcPayDialog() {
  if (!state.isOpen || !state.isHidden) return;
  setState({ ...state, isHidden: false });
}

export function useWcPayDialogState(): IWcPayDialogState {
  return useSyncExternalStore(subscribeWcPayDialog, getWcPayDialogState);
}
