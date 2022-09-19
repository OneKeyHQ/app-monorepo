import React from 'react';

import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';

import { useIsVerticalLayout } from '@onekeyhq/components';

import WalletSelectorChildren from './WalletSelectorChildren';

function WalletSelectorMobile(props: DrawerContentComponentProps) {
  const isVerticalLayout = useIsVerticalLayout();
  if (!isVerticalLayout) {
    return null;
  }
  // accountSelectorInfo, isOpen
  return (
    <DrawerContentScrollView
      {...props}
      scrollEnabled={false}
      contentContainerStyle={{ flexDirection: 'row', flex: 1 }}
    >
      {/* AccountSelectorMobile */}
      <WalletSelectorChildren />
    </DrawerContentScrollView>
  );
}

export { WalletSelectorMobile };
