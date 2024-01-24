import { useEffect } from 'react';

import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorStorageInit() {
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  useEffect(() => {
    void actions.current.initFromStorage({
      sceneName,
      sceneUrl,
    });
  }, [actions, sceneName, sceneUrl]);

  return null;
}
