import { useMemo } from 'react';

import { Button, XStack } from '@onekeyhq/components';
import { useFirmwareUpdatesDetectStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { BootloaderModeUpdateReminder } from './BootloaderModeUpdateReminder';
import { HomeFirmwareUpdateDetect } from './HomeFirmwareUpdateDetect';

function HomeFirmwareUpdateReminderCmp() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();

  const [detectStatus] = useFirmwareUpdatesDetectStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const shouldUpdate = useMemo(() => {
    if (!connectId) return false;
    const detectResult = detectStatus?.[connectId];
    return detectResult?.connectId === connectId && detectResult?.hasUpgrade;
  }, [connectId, detectStatus]);

  const updateButton = useMemo(() => {
    if (shouldUpdate) {
      return (
        <Button
          size="small"
          onPress={async () => {
            actions.openChangeLogModal({ connectId });
          }}
        >
          New firmware!
        </Button>
      );
    }
    return null;
  }, [actions, connectId, shouldUpdate]);

  return (
    <XStack px="$4">
      <HomeFirmwareUpdateDetect />
      <BootloaderModeUpdateReminder />
      {updateButton}
    </XStack>
  );
}

export function HomeFirmwareUpdateReminder() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <HomeFirmwareUpdateReminderCmp />
    </AccountSelectorProviderMirror>
  );
}
