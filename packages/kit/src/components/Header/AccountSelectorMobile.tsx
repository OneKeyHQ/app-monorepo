import type { FC } from 'react';
import { memo } from 'react';

import {
  DrawerContentScrollView,
  useDrawerStatus,
} from '@react-navigation/drawer';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from '../LazyDisplayView';
import { useAccountSelectorInfo } from '../NetworkAccountSelector/hooks/useAccountSelectorInfo';

import AccountSelectorChildren from './AccountSelectorChildren';

import type { DrawerContentComponentProps } from '@react-navigation/drawer';

const AccountSelectorMobile: FC<DrawerContentComponentProps> = (props) => {
  const status = useDrawerStatus();
  const isOpen = status === 'open';

  const accountSelectorInfo = useAccountSelectorInfo();

  return (
    <LazyDisplayView
      delay={200}
      hideOnUnmount={false}
      isLazyDisabled={platformEnv.isNative}
    >
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
