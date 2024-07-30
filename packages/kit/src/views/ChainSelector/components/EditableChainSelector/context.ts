import { createContext } from 'react';

import type { IEditableChainSelectorContext } from './type';

export const EditableChainSelectorContext =
  createContext<IEditableChainSelectorContext>({
    frequentlyUsedItems: [],
    frequentlyUsedItemsIds: new Set(),
  });
