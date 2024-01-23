import { useIsVerticalLayout } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type {
  IInscriptionContent,
  IInscriptionHistory,
} from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { BRC20Amount } from '../../../views/Inscribe/BRC20Amount';
import CreateContent from '../../../views/Inscribe/CreateContent';
import CreateOrder from '../../../views/Inscribe/CreateOrder';
import { InscribeTransferFromDapp } from '../../../views/Inscribe/InscribeTransferFromDapp';
import OrderDetail from '../../../views/Inscribe/OrderDetail';
import OrderList from '../../../views/Inscribe/OrderList';
import ReceiveAddress from '../../../views/Inscribe/ReceiveAddress';
import { InscribeModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type { InscribeFile } from '../../../views/Inscribe/Components/InscribeUploader/type';

export type InscribeModalRoutesParams = {
  [InscribeModalRoutes.InscribeTransferFromDapp]: {
    sourceInfo?: IDappSourceInfo;
  };
  [InscribeModalRoutes.InscribeModal]: {
    networkId: string;
    accountId: string;
  };
  [InscribeModalRoutes.BRC20Amount]: {
    networkId: string;
    accountId: string;
    token?: Token;
    amount?: string;
    sourceInfo?: IDappSourceInfo;
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
    sourceInfo?: IDappSourceInfo;
  };
};

const InscribeModalNavigator =
  createStackNavigator<InscribeModalRoutesParams>();

const modalRoutes = [
  {
    name: InscribeModalRoutes.InscribeTransferFromDapp,
    component: InscribeTransferFromDapp,
  },
  {
    name: InscribeModalRoutes.InscribeModal,
    component: CreateContent,
  },
  {
    name: InscribeModalRoutes.BRC20Amount,
    component: BRC20Amount,
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
