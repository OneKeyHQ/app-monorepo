import React from 'react';

import Toast from '@onekeyhq/components/src/Toast/Custom';

import HardwarePopup from '../views/Hardware/PopupHandle';

export function PortalElementsContainer() {
  return (
    <>
      {/* Native Modal must register another for root container */}
      <Toast bottomOffset={60} />
      <HardwarePopup />
    </>
  );
}
