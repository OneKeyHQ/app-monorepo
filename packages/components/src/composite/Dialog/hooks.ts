import { useCallback, useContext } from 'react';

import { DialogContext } from './context';

import type { IDialogInstance } from './type';

export const useDialogInstance: () => IDialogInstance = () => {
  const { dialogInstance } = useContext(DialogContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getForm = useCallback(() => dialogInstance.ref.current, []);
  return {
    close: dialogInstance?.close,
    getForm,
  };
};
