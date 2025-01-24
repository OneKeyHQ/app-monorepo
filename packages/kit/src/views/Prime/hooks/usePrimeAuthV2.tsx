import { useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';

import { PrimeLoginEmailCodeDialogV2 } from '../components/PrimeLoginEmailCodeDialogV2';
import { PrimeLoginEmailDialogV2 } from '../components/PrimeLoginEmailDialogV2';

export function usePrimeAuthV2() {
  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);

  const loginWithEmail = async () => {
    Dialog.show({
      renderContent: <PrimeLoginEmailDialogV2 />,
      onClose: async () => {
        Dialog.show({
          renderContent: <PrimeLoginEmailCodeDialogV2 />,
          onClose: async () => {},
        });
      },
    });
  };

  return { loginWithEmail };
}
