import React, { FC, memo } from 'react';

import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  useDrawerStatus,
} from '@react-navigation/drawer';

import AccountSelectorChildren from './AccountSelectorChildren';

const AccountSelectorMobile: FC<DrawerContentComponentProps> = (props) => {
  const status = useDrawerStatus();
  const isOpen = status === 'open';

  return (
    <DrawerContentScrollView
      {...props}
      scrollEnabled={false}
      contentContainerStyle={{ flexDirection: 'row', flex: 1 }}
    >
      <AccountSelectorChildren isOpen={isOpen} />
    </DrawerContentScrollView>
  );
};

export default memo(AccountSelectorMobile);
