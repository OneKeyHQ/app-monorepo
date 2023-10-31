import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

import type { DialogContextForm, DialogInstanceRef } from './type';

export const DialogContext = createContext<{
  dialogInstance?: DialogInstanceRef;
  form?: DialogContextForm;
  setForm?: Dispatch<SetStateAction<DialogContextForm>>;
}>({});
