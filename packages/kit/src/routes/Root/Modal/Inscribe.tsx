import { useIsVerticalLayout } from '@onekeyhq/components';
import type { IAccount } from '@onekeyhq/engine/src/types';
import type {
  IInscriptionContent,
  IInscriptionHistory,
} from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';

import CreateContent from '../../../views/Inscribe/CreateContent';
import CreateOrder from '../../../views/Inscribe/CreateOrder';
import OrderDetail from '../../../views/Inscribe/OrderDetail';
import OrderList from '../../../views/Inscribe/OrderList';
import ReceiveAddress from '../../../views/Inscribe/ReceiveAddress';
import { InscribeModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type { InscribeFile } from '../../../views/Inscribe/Components/InscribeUploader/type';

export type InscribeModalRoutesParams = {
  [InscribeModalRoutes.InscribeModal]: {
    networkId: string;
    accountId: string;
  };
  [InscribeModalRoutes.OrderList]: undefined;
  [InscribeModalRoutes.OrderDetail]: {
    orderHistory: IInscriptionHistory;
  };
  [InscribeModalRoutes.ReceiveAddress]: {
    networkId: string;
    accountId: string;
    address?: string;
    contents: IInscriptionContent[];
    size: number;
    file?: InscribeFile;
  };
  [InscribeModalRoutes.CreateOrder]: {
    networkId: string;
    accountId: string;
    contents: IInscriptionContent[];
    receiveAddress: string;
    orderId: string;
    size: number;
    file?: InscribeFile;
  };
};

const InscribeModalNavigator =
  createStackNavigator<InscribeModalRoutesParams>();

const modalRoutes = [
  {
    name: InscribeModalRoutes.InscribeModal,
    component: CreateContent,
  },
  {
    name: InscribeModalRoutes.OrderList,
    component: OrderList,
  },
  {
    name: InscribeModalRoutes.OrderDetail,
    component: OrderDetail,
  },
  {
    name: InscribeModalRoutes.ReceiveAddress,
    component: ReceiveAddress,
  },
  {
    name: InscribeModalRoutes.CreateOrder,
    component: CreateOrder,
  },
];

const InscribeModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <InscribeModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <InscribeModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </InscribeModalNavigator.Navigator>
  );
};

export default InscribeModalStack;
