import React from 'react';

import { DialogManager } from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HardwarePopup from '../views/Hardware/PopupHandle';

export function PortalElementsContainer() {
  return (
    <>
      {/* Native Modal must register another for root container */}
      {platformEnv.isNativeIOS && <Toast bottomOffset={60} />}
      {platformEnv.isNativeIOS && <DialogManager.Holder />}
      {platformEnv.isNativeIOS && <HardwarePopup />}
    </>
  );
}
