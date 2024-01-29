import { useEffect } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useDeriveTypeAutoSelect({ num }: { num: number }) {
  const { selectedAccount } = useSelectedAccount({ num });
  const {
    activeAccount: { deriveInfoItems, deriveInfo },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  // auto select first derive type
  // TODO auto select global default derive type
  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (
      !deriveInfo &&
      deriveInfoItems.length > 0 &&
      deriveInfoItems[0].value &&
      selectedAccount.deriveType !== deriveInfoItems[0].value
    ) {
      actions.current.updateSelectedAccount({
        num,
        builder: (v) => ({
          ...v,
          deriveType: deriveInfoItems[0].value as IAccountDeriveTypes,
        }),
      });
    }
  }, [
    actions,
    deriveInfo,
    deriveInfoItems,
    isReady,
    num,
    selectedAccount.deriveType,
  ]);
}
