import { createContext } from 'react';

import type { IDialogContextType } from './type';

export const DialogContext = createContext<IDialogContextType>(
  {} as IDialogContextType,
);

// True only while the dialog content is mounted inside the tamagui Sheet used
// on `md`. Sheet.ScrollView reads the sheet context, so it must never render
// outside of that subtree.
export const DialogSheetContext = createContext(false);
