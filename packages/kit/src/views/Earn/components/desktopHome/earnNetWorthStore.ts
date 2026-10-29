import { useSyncExternalStore } from 'react';

/**
 * The DeFi home's Net Worth as it last showed it, for My portfolio's total:
 * one name, one number (demo 10-29). The two pages read their totals from
 * different requests, which can differ by cents; My portfolio shows the
 * home's figure for the account it was worked out for, and its own sum
 * where the home hasn't shown one.
 */
type IHomeNetWorth = {
  /** The indexed account, or the account where there is none */
  accountKey: string;
  value: string;
};

let current: IHomeNetWorth | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => current;

export function publishHomeNetWorth(next: IHomeNetWorth) {
  if (current?.accountKey === next.accountKey && current.value === next.value) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
}

export function useHomeNetWorth(accountKey: string) {
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return accountKey && entry?.accountKey === accountKey
    ? entry.value
    : undefined;
}
