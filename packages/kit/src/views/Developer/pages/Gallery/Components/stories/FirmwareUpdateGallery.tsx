import { useMemo } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateRetryAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { Layout } from './utils/Layout';

function Demo() {
  const [retryInfo] = useFirmwareUpdateRetryAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();

  const bootModeButton = useMemo(
    () => (
      <Button
        onPress={() => {
          actions.showBootloaderMode();
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

  return (
    <Stack space="$2">
      <>{bootModeButton}</>
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
          <Stack space="$1">
            <Demo />
          </Stack>
        ),
      },
    ]}
  />
);

export default FirmwareUpdateGallery;
