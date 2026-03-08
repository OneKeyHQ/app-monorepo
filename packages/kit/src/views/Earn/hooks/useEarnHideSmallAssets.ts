import { useCallback, useMemo } from 'react';

import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

import { useEarnAccountKey } from './useEarnAccountKey';

export const useEarnHideSmallAssets = () => {
  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();
  const earnAccountKey = useEarnAccountKey();

  const hideSmallAssets = useMemo(
    () =>
      Boolean(earnAccountKey && earnAccount?.[earnAccountKey]?.hideSmallAssets),
    [earnAccount, earnAccountKey],
  );

  const setHideSmallAssets = useCallback(
    (nextValue: boolean) => {
      if (!earnAccountKey) return;
      const latestAccount =
        actions.current.getEarnAccount(earnAccountKey) ||
        earnAccount?.[earnAccountKey];
      if (latestAccount?.hideSmallAssets === nextValue) {
        return;
      }
      actions.current.updateEarnAccounts({
        key: earnAccountKey,
        earnAccount: {
          ...(latestAccount ?? { accounts: [] }),
          hideSmallAssets: nextValue,
        },
      });
    },
    [actions, earnAccount, earnAccountKey],
  );

  return {
    hideSmallAssets,
    setHideSmallAssets,
  };
};
