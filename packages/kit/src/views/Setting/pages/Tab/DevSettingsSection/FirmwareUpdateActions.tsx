import { Button, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import {
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdatesDetectStatusPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function ForceOpenHomeDeviceUpdateFirmwareModal() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();
  return (
    <Button
      onPress={async () => {
        await actions.openChangeLogModal({ connectId });
      }}
    >
      NormalModeUpdate
    </Button>
  );
}

function ResetDetectTimeCheck() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  return (
    <Button
      onPress={() => {
        if (!connectId) {
          return;
        }
        void backgroundApiProxy.serviceFirmwareUpdate.resetShouldDetectTimeCheck(
          {
            connectId,
          },
        );
      }}
    >
      ResetDetectTimeCheck
    </Button>
  );
}

function BootloaderModeUpdateButton() {
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const actions = useFirmwareUpdateActions();
  return (
    <Button
      onPress={() => {
        actions.showBootloaderMode({ connectId: undefined });
        console.log({
          retryInfo,
        });
      }}
    >
      BootloaderModeUpdate
    </Button>
  );
}

function ClearUpdateInfoDetectCacheButton() {
  const [, setDetectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  return (
    <Button
      onPress={() => {
        setDetectStatus(undefined);
      }}
    >
      ClearUpdateInfoDetectCache
    </Button>
  );
}

export function FirmwareUpdateActions() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <Stack gap="$2">
        <ForceOpenHomeDeviceUpdateFirmwareModal />
        <BootloaderModeUpdateButton />
        <ClearUpdateInfoDetectCacheButton />
        <ResetDetectTimeCheck />
        <Button
          onPress={() => {
            appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateForce, {
              connectId: undefined,
            });
            appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateForce, {
              connectId: undefined,
            });
            Toast.message({
              title: 'ForceUpdateDialog',
            });
          }}
        >
          ForceUpdateDialog
        </Button>
      </Stack>
    </AccountSelectorProviderMirror>
  );
}
