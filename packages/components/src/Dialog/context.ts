import { createContext } from 'react';

import type { IDialogContextType } from './type';

export const DialogContext = createContext<IDialogContextType>({});
