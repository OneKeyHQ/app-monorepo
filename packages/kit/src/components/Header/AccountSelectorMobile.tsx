import React, { FC } from 'react';

import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';

import AccountSelectorChildren from './AccountSelectorChildren';

const AccountSelectorDesktop: FC<DrawerContentComponentProps> = (props) => (
  <DrawerContentScrollView
    {...props}
    scrollEnabled={false}
    contentContainerStyle={{ flexDirection: 'row', flex: 1 }}
  >
    <AccountSelectorChildren />
  </DrawerContentScrollView>
);

export default AccountSelectorDesktop;
