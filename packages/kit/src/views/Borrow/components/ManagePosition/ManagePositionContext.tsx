import { createContext, useContext } from 'react';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import type { IManagePositionContextValue } from './types';

const ManagePositionContext = createContext<IManagePositionContextValue | null>(
  null,
);

export function useManagePositionContext(): IManagePositionContextValue {
  const context = useContext(ManagePositionContext);
  if (!context) {
    throw new OneKeyInternalError(
      'useManagePositionContext must be used within ManagePositionProvider',
    );
  }
  return context;
}

export { ManagePositionContext };
