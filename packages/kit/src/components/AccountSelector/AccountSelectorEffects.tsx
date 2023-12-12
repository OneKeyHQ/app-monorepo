import { useEffect } from 'react';

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

export function AccountSelectorEffects({
  num,
  children,
}: {
  num: number;
  children?: any;
}) {
  // TODO multiple UI sync
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName } = useAccountSelectorSceneInfo();

  useEffect(() => {
    void actions.current.initFromStorage({
      sceneName,
      num,
    });
  }, [actions, num, sceneName]);

  useEffect(() => {
    void actions.current.reloadActiveAccountInfo({ num, selectedAccount });
    if (!isSelectedAccountDefaultValue) {
      void actions.current.saveToStorage({
        selectedAccount,
        sceneName,
        num,
      });
    } else {
      console.log(
        'AccountSelector saveToStorage skip:  isSelectedAccountDefaultValue',
      );
    }
  }, [actions, isSelectedAccountDefaultValue, num, sceneName, selectedAccount]);

  if (isReady) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return children;
  }
  return null;
}
