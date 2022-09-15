import React, { FC, memo } from 'react';

import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  useDrawerStatus,
} from '@react-navigation/drawer';

import { LazyDisplayView } from '../LazyDisplayView';

import AccountSelectorChildren from './AccountSelectorChildren';
import { useAccountSelectorInfo } from './AccountSelectorChildren/useAccountSelectorInfo';

const AccountSelectorMobile: FC<DrawerContentComponentProps> = (props) => {
  const status = useDrawerStatus();
  const isOpen = status === 'open';

  const accountSelectorInfo = useAccountSelectorInfo({
    isOpen,
  });

  return (
    <LazyDisplayView delay={200} hideOnUnmount={false}>
      <DrawerContentScrollView
        {...props}
        scrollEnabled={false}
        contentContainerStyle={{ flexDirection: 'row', flex: 1 }}
      >
        <AccountSelectorChildren
          isOpen={isOpen}
          accountSelectorInfo={accountSelectorInfo}
        />
      </DrawerContentScrollView>
    </LazyDisplayView>
  );
};

export default memo(AccountSelectorMobile);
