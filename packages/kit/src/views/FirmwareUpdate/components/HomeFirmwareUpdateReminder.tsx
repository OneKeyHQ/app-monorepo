import { useMemo } from 'react';

import { Button, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { useFirmwareUpdatesDetectStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { BootloaderModeUpdateReminder } from './BootloaderModeUpdateReminder';
import { HomeFirmwareUpdateDetect } from './HomeFirmwareUpdateDetect';

export function FirmwareUpdateReminderAlert({
  message,
  onPress,
}: {
  message: string;
  onPress?: () => any;
}) {
  return (
    <XStack p="$2" backgroundColor="$bgInfoSubdued" flex={1}>
      <Icon name="DownloadOutline" />
      <Stack mx="$4" flex={1}>
        <SizableText>{message}</SizableText>
      </Stack>
      <Button size="small" onPress={onPress}>
        View
      </Button>
    </XStack>
  );
}

function HomeFirmwareUpdateReminderCmp() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();

  const [detectStatus] = useFirmwareUpdatesDetectStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(async () => {
    if (!connectId) return undefined;
    const detectResult = detectStatus?.[connectId];
    const shouldUpdate =
      detectResult?.connectId === connectId && detectResult?.hasUpgrade;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const detectInfo =
      await backgroundApiProxy.serviceFirmwareUpdate.getFirmwareUpdateDetectInfo(
        {
          connectId,
        },
      );
    return {
      shouldUpdate,
      detectResult,
    };
  }, [connectId, detectStatus]);

  const updateButton = useMemo(() => {
    if (result?.shouldUpdate) {
      let message = 'New firmware is available';
      if (result?.detectResult?.toVersion) {
        message = `Firmware ${result?.detectResult?.toVersion} is available`;
      } else if (result?.detectResult?.toVersionBle) {
        message = `BLE Firmware ${result?.detectResult?.toVersionBle} is available`;
      }
      return (
        <FirmwareUpdateReminderAlert
          message={message}
          onPress={async () => {
            actions.openChangeLogModal({ connectId });
          }}
        />
      );
    }
    return null;
  }, [actions, connectId, result]);

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
