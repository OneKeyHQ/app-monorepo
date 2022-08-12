import React from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import Toast from '@onekeyhq/components/src/Toast/Custom';

import HardwarePopup from '../views/Hardware/PopupHandle';

export const PortalElementsContainer = () => (
  <RootSiblingParent>
    <Toast bottomOffset={60} />
    <HardwarePopup />
  </RootSiblingParent>
);
