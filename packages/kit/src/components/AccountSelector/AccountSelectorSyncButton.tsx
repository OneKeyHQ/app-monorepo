import { Button } from '@onekeyhq/components';

import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';

import type { IAccountSelectorSyncFromSceneParams } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorSyncButton(
  params: IAccountSelectorSyncFromSceneParams,
) {
  const actions = useAccountSelectorActions();
  const { sceneName } = params;
  return (
    <Button
      size="small"
      onPress={() => {
        void actions.current.syncFromScene(params);
      }}
    >
      Sync from {sceneName}
    </Button>
  );
}
