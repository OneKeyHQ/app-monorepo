import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import {
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdatesDetectStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from './utils/Layout';

function ForceOpenHomeDeviceUpdateFirmwareModal() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();
  return (
    <Button
      onPress={async () => {
        actions.openChangeLogModal({ connectId });
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
  const [, setDetectStatus] = useFirmwareUpdatesDetectStatusAtom();
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

export function FirmwareUpdateGalleryDemo() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <Stack space="$2">
        <>
          <ForceOpenHomeDeviceUpdateFirmwareModal />
          <BootloaderModeUpdateButton />
          <ClearUpdateInfoDetectCacheButton />
          <ResetDetectTimeCheck />
        </>
      </Stack>
    </AccountSelectorProviderMirror>
  );
}

const FirmwareUpdateGallery = () => (
  <Layout
    description="--"
    suggestions={['--']}
    boundaryConditions={['--']}
    elements={[
      {
        title: '--',
        element: (
          <Stack space="$1">
            <FirmwareUpdateGalleryDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default FirmwareUpdateGallery;
