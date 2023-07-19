import { useEffect } from 'react';

import { Box, useProviderValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAccountSelectorEffectsSingleton } from '../../../components/NetworkAccountSelector/hooks/useAccountSelectorEffects';
import { WalletSelectorEffectsSingleton } from '../../../components/WalletSelector/hooks/useWalletSelectorEffects';
import { available, enable } from '../../../store/reducers/autoUpdater';
import { createLazyComponent } from '../../../utils/createLazyComponent';
import appUpdates from '../../../utils/updates/AppUpdates';

const UpdateAlert = createLazyComponent(
  () => import('../../../views/Update/Alert'),
);

// const Drawer = createLazyComponent(() => import('./Drawer'));

function MainScreen() {
  const { dispatch } = backgroundApiProxy;

  const { reduxReady } = useProviderValue();

  useEffect(() => {
    if (reduxReady) {
      appUpdates.addUpdaterListener();
      appUpdates
        .checkUpdate()
        ?.then((versionInfo) => {
          if (versionInfo) {
            dispatch(enable(), available(versionInfo));
          }
        })
        .catch();
    }
  }, [dispatch, reduxReady]);

  return (
    <Box ref={setMainScreenDom} w="full" h="full">
      {/* <Drawer /> */}
      {/* <NetworkAccountSelectorEffectsSingleton /> */}
      {/* <WalletSelectorEffectsSingleton /> */}
      {/* TODO Waiting notification component */}
      {/* <UpdateAlert /> */}
    </Box>
  );
}

export default MainScreen;
