import React from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import Toast from '@onekeyhq/components/src/Toast/Custom';

import HardwarePopup from '../views/Hardware/PopupHandle';
import HardwareSpecialPopup from '../views/Hardware/PopupHandle/SpecialPopup';

export const PortalElementsContainer = () => (
  <RootSiblingParent>
    {/* Native Modal must register another for root container */}
    <Toast bottomOffset={60} />
    <HardwarePopup />
    <HardwareSpecialPopup />
  </RootSiblingParent>
);
