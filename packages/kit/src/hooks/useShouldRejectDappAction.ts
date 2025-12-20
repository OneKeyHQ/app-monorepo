import { useCallback } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

function useShouldRejectDappAction() {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const shouldRejectDappAction = useCallback(() => {
    if (
      platformEnv.isExtensionUiStandaloneWindow ||
      platformEnv.isExtensionUiPopup
    ) {
      return hardwareTransportType !== EHardwareTransportType.WEBUSB;
    }
    return true;
  }, [hardwareTransportType]);

  return {
    shouldRejectDappAction,
  };
}

export default useShouldRejectDappAction;
