import type { ComponentType } from 'react';
import { memo, useMemo } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { createLazyComponent } from '../../utils/createLazyComponent';
import { ModalRoutes } from '../types';

import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';
import ManageNetworkModal from './ManageNetwork';

import type { ModalRoutesParams } from '../types';

const modalStackScreenList: (
  | {
      name: keyof ModalRoutesParams;
      children: {
        name: keyof ModalRoutesParams;
        component: ComponentType<any>;
      }[];
    }
  | {
      name: keyof ModalRoutesParams;
      component: ComponentType<any>;
    }
)[] = [
  {
    name: ModalRoutes.CreateAccount,
    component: createLazyComponent(() => import('./CreateAccount')),
  },
  {
    name: ModalRoutes.RecoverAccount,
    component: createLazyComponent(() => import('./RecoverAccount')),
  },
  {
    name: ModalRoutes.Receive,
    component: createLazyComponent(
      () => import('@onekeyhq/kit/src/views/ReceiveToken'),
    ),
  },
  {
    name: ModalRoutes.Send,
    component: createLazyComponent(() => import('./Send')),
  },
  {
    name: ModalRoutes.ScanQrcode,
    component: createLazyComponent(() => import('./ScanQrcode')),
  },
  {
    name: ModalRoutes.BackupWallet,
    component: createLazyComponent(() => import('./BackupWallet')),
  },
  {
    name: ModalRoutes.TransactionDetail,
    component: createLazyComponent(() => import('./TransactionDetail')),
  },
  {
    name: ModalRoutes.ManageToken,
    component: createLazyComponent(() => import('./ManageToken')),
  },
  {
    name: ModalRoutes.SubmitRequest,
    component: createLazyComponent(() => import('./SubmitRequest')),
  },
  {
    name: ModalRoutes.HistoryRequest,
    component: createLazyComponent(() => import('./HistoryRequest')),
  },
  {
    name: ModalRoutes.Password,
    component: createLazyComponent(() => import('./Password')),
  },
  {
    name: ModalRoutes.OnekeyLiteReset,
    component: createLazyComponent(() => import('./HardwareOnekeyLiteReset')),
  },
  {
    name: ModalRoutes.OnekeyLiteChangePinInputPin,
    component: createLazyComponent(
      () => import('./HardwareOnekeyLiteChangePin'),
    ),
  },
  {
    name: ModalRoutes.DappConnectionModal,
    component: createLazyComponent(() => import('./DappConnection')),
  },
  {
    name: ModalRoutes.Collectibles,
    component: createLazyComponent(() => import('./Collectibles')),
  },
  {
    name: ModalRoutes.CreateWallet,
    component: createLazyComponent(() => import('./CreateWallet')),
  },
  {
    name: ModalRoutes.ManagerWallet,
    component: createLazyComponent(() => import('./ManagerWallet')),
  },
  {
    name: ModalRoutes.ManagerAccount,
    component: createLazyComponent(() => import('./ManagerAccount')),
  },
  {
    name: ModalRoutes.EnableLocalAuthentication,
    component: createLazyComponent(() => import('./EnableLocalAuthentication')),
  },
  {
    name: ModalRoutes.ManageNetwork,
    children: ManageNetworkModal,
  },
  {
    name: ModalRoutes.OnekeyHardware,
    component: createLazyComponent(() => import('./HardwareOnekey')),
  },
  {
    name: ModalRoutes.HardwareUpdate,
    component: createLazyComponent(() => import('./HardwareUpdate')),
  },
  {
    name: ModalRoutes.Discover,
    component: createLazyComponent(() => import('./Discover')),
  },
  {
    name: ModalRoutes.Swap,
    component: createLazyComponent(() => import('./Swap')),
  },
  {
    name: ModalRoutes.UpdateFeature,
    component: createLazyComponent(() => import('./UpdateFeature')),
  },
  {
    name: ModalRoutes.FiatPay,
    component: createLazyComponent(() => import('./FiatPay')),
  },
  {
    name: ModalRoutes.AddressBook,
    component: createLazyComponent(() => import('./AddressBook')),
  },
  {
    name: ModalRoutes.ImportBackupPassword,
    component: createLazyComponent(() => import('./ImportBackupPassword')),
  },
  {
    name: ModalRoutes.Staking,
    component: createLazyComponent(() => import('./Staking')),
  },
  {
    name: ModalRoutes.ManageConnectedSites,
    component: createLazyComponent(() => import('./ManageConnectSites')),
  },
  {
    name: ModalRoutes.PushNotification,
    component: createLazyComponent(() => import('./PushNotification')),
  },
  {
    name: ModalRoutes.Webview,
    component: createLazyComponent(
      () => import('@onekeyhq/kit/src/views/Webview'),
    ),
  },
  {
    name: ModalRoutes.Revoke,
    component: createLazyComponent(() => import('./Revoke')),
  },
  {
    name: ModalRoutes.NFTMarket,
    component: createLazyComponent(() => import('./NFTMarket')),
  },
  {
    name: ModalRoutes.Overview,
    component: createLazyComponent(() => import('./Overview')),
  },
  {
    name: ModalRoutes.BulkSender,
    component: createLazyComponent(() => import('./BulkSender')),
  },
  {
    name: ModalRoutes.Market,
    component: createLazyComponent(() => import('./Market')),
  },

  {
    name: ModalRoutes.CurrencySelect,
    component: createLazyComponent(() => import('./CurrencySelect')),
  },
];

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // presentation: 'modal' as const,
      ...buildModalOpenAnimationOptions({ isVerticalLayout }),
    }),
    [isVerticalLayout],
  );
  return (
    <RootSiblingParent>
      <ModalStack.Navigator screenOptions={screenOptions}>
        {modalStackScreenList.map((modalStacks) => {
          if ('component' in modalStacks) {
            return (
              <ModalStack.Screen
                key={modalStacks.name}
                name={modalStacks.name}
                component={modalStacks.component}
              />
            );
          }
          return (
            <ModalStack.Group key={modalStacks.name}>
              {modalStacks.children.map((subModal) => (
                <ModalStack.Screen
                  key={subModal.name}
                  name={subModal.name}
                  component={subModal.component}
                />
              ))}
            </ModalStack.Group>
          );
        })}
      </ModalStack.Navigator>
    </RootSiblingParent>
  );
};

export default memo(ModalStackNavigator);
