import { Button } from '@onekeyhq/components';

import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

import { AccountSelectorTestIDs } from './testIDs';

import type { IAccountSelectorSyncFromSceneParams } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorSyncButton(
  params: IAccountSelectorSyncFromSceneParams,
) {
  const actions = useAccountSelectorActions();
  const { from } = params;
  return (
    <Button
      testID={AccountSelectorTestIDs.syncButton}
      size="small"
      onPress={() => {
        void actions.current.syncFromScene(params);
      }}
    >
      Sync from {from.sceneName}
    </Button>
  );
}
