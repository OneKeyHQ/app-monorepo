import React from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import HardwarePopup from '../views/Hardware/PopupHandle';

export const PortalElementsContainer = () => (
  <RootSiblingParent>
    <HardwarePopup />
  </RootSiblingParent>
);
