import React, { FC } from 'react';

import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  useDrawerStatus,
} from '@react-navigation/drawer';

import AccountSelectorChildren from './AccountSelectorChildren';

const AccountSelectorMobile: FC<DrawerContentComponentProps> = (props) => {
  const status = useDrawerStatus();

  return (
    <DrawerContentScrollView
      {...props}
      scrollEnabled={false}
      contentContainerStyle={{ flexDirection: 'row', flex: 1 }}
    >
      <AccountSelectorChildren isOpen={status === 'open'} />
    </DrawerContentScrollView>
  );
};

export default AccountSelectorMobile;
