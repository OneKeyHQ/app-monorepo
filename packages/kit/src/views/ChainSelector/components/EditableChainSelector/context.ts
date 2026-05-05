import { createContext } from 'react';

import type { IEditableChainSelectorContext } from './type';

export const EditableChainSelectorContext =
  createContext<IEditableChainSelectorContext>({
    walletId: '',
    frequentlyUsedItems: [],
    frequentlyUsedItemsIds: new Set(),
    accountNetworkValues: {},
    accountDeFiOverview: {},
  });
