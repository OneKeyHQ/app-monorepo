import { useMemo } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import {
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdatesDetectStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { Layout } from './utils/Layout';

function ForceOpenHomeDeviceUpdateFirmwareModal() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();
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

function ResetDetectTimeCheck() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  return (
    <Button
      onPress={() => {
        if (!connectId) {
          return;
        }
        backgroundApiProxy.serviceFirmwareUpdate.resetShouldDetectTimeCheck({
          connectId,
        });
      }}
    >
      ResetDetectTimeCheck
    </Button>
  );
}

function Demo() {
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const [, setDetectStatus] = useFirmwareUpdatesDetectStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();

  const bootModeButton = useMemo(
    () => (
      <Button
        onPress={() => {
          actions.showBootloaderMode({ connectId: undefined });
          console.log({
            retryInfo,
          });
        }}
      >
        boot-mode
      </Button>
    ),
    [actions, retryInfo],
  );

  const clearUpdateCache = useMemo(
    () => (
      <Button
        onPress={() => {
          setDetectStatus(undefined);
        }}
      >
        clearUpdateCache
      </Button>
    ),
    [setDetectStatus],
  );

  return (
    <Stack space="$2">
      <>
        {bootModeButton}
        {clearUpdateCache}
        <ForceOpenHomeDeviceUpdateFirmwareModal />
        <ResetDetectTimeCheck />
      </>
    </Stack>
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
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
            }}
            enabledNum={[0]}
          >
            <Stack space="$1">
              <Demo />
            </Stack>
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default FirmwareUpdateGallery;
