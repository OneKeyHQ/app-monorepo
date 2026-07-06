import { useCallback } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useAccountSelectorContextData } from './atoms';

import type { IAccountSelectorActionsInstance } from './actions';
import type { WritableAtom } from 'jotai';

type IAccountSelectorLazyAction<Args extends unknown[], Result> = {
  atom: () => WritableAtom<null, Args, Result>;
};

type IAccountSelectorLazyActionName = keyof IAccountSelectorActionsInstance;

function getLazyAction<Args extends unknown[], Result>({
  actions,
  name,
}: {
  actions: IAccountSelectorActionsInstance;
  name: IAccountSelectorLazyActionName;
}) {
  const action = actions[name] as unknown as
    | IAccountSelectorLazyAction<Args, Result>
    | undefined;
  if (!action?.atom) {
    throw new OneKeyLocalError(
      `Account selector lazy action not found: ${String(name)}`,
    );
  }
  return action;
}

export function useAccountSelectorLazyAction() {
  const { store } = useAccountSelectorContextData();

  return useCallback(
    async <Args extends unknown[], Result>(
      name: IAccountSelectorLazyActionName,
      ...args: Args
    ) => {
      if (!store) {
        throw new OneKeyLocalError(
          'useAccountSelectorLazyAction ERROR: store not initialized',
        );
      }
      const { getAccountSelectorActions } = await import('./actions');
      const actions = getAccountSelectorActions();
      const action = getLazyAction<Args, Result>({
        actions,
        name,
      });
      return store.set(action.atom(), ...args);
    },
    [store],
  );
}
