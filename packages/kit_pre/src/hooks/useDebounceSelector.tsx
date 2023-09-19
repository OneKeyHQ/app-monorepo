import { useEffect, useRef, useState } from 'react';

import { createSelector } from 'reselect';

import { useAppSelector } from './useAppSelector';

import type { IAppState } from '../store';
// import type { TypedUseSelectorHook } from 'react-redux';

type SelectorFunction<T> = (state: IAppState) => T;

export const useDebounceSelector = <T,>(
  selector: SelectorFunction<T>,
  time = 250,
): T | undefined => {
  console.error('useDebounceSelector not ready yet');
  const [data, setState] = useState<T | undefined>(undefined);
  const result = useRef<T | undefined>(undefined);
  const refTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  if (refTimeout.current) {
    clearTimeout(refTimeout.current);
  }

  const selectorData = useAppSelector(selector);

  useEffect(
    () => () => {
      if (refTimeout.current) {
        clearTimeout(refTimeout.current);
      }
    },
    [],
  );

  if (time === 0) {
    return selectorData;
  }

  refTimeout.current = setTimeout(() => {
    if (result.current !== selectorData) {
      setState(selectorData);
      result.current = selectorData;
    }
  }, time);

  return data;
};

const isUnlockSelectorSample = (s: IAppState) => s.status.isUnlock;
const activeAccountIdSelectorSample = (s: IAppState) =>
  s.general.activeAccountId;
const batchDataMergedSelectorSample = createSelector(
  isUnlockSelectorSample,
  activeAccountIdSelectorSample,
  (isUnlock, activeAccountId) => ({
    status: { isUnlock },
    account: { activeAccountId },
  }),
);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DebounceSelectorExampleView() {
  const result = useDebounceSelector(batchDataMergedSelectorSample);
  return <>{result?.account.activeAccountId}</>;
}
