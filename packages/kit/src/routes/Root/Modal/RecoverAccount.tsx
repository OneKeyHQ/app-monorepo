import { useIsVerticalLayout } from '@onekeyhq/components';
import BitcoinUsedAddress from '@onekeyhq/kit/src/views/Account/AddNewAccount/BitcoinUsedAddress';

import RecoverAccountsAdvanced from '../../../views/Account/AddNewAccount/RecoverAccountsAdvanced';
import BulkCopyAddresses from '../../../views/Account/BulkCopyAddress';
import { RecoverAccountModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

type RecoverAccountsAdvancedParams = {
  fromIndex: number;
  generateCount?: number;
  networkId?: string;
};

export type RecoverAccountRoutesParams = {
  [RecoverAccountModalRoutes.RecoverAccountsAdvanced]: RecoverAccountsAdvancedParams & {
    onApply: (options: RecoverAccountsAdvancedParams) => void;
  };
  [RecoverAccountModalRoutes.BulkCopyAddresses]: {
    networkId: string;
    walletId: string;
    password: string;
    entry: 'accountSelector' | 'manageAccount';
    template?: string;
  };
  [RecoverAccountModalRoutes.BitcoinUsedAddress]: {
    walletId: string;
    accountId: string;
    networkId: string;
    entry: 'usedAddress' | 'manageAccount';
  };
};

const RecoverAccountNavigator =
  createStackNavigator<RecoverAccountRoutesParams>();

const modalRoutes = [
  {
    name: RecoverAccountModalRoutes.RecoverAccountsAdvanced,
    component: RecoverAccountsAdvanced,
  },
  {
    name: RecoverAccountModalRoutes.BulkCopyAddresses,
    component: BulkCopyAddresses,
  },
  {
    name: RecoverAccountModalRoutes.BitcoinUsedAddress,
    component: BitcoinUsedAddress,
  },
];

const RecoverAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <RecoverAccountNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <RecoverAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </RecoverAccountNavigator.Navigator>
  );
};

export default RecoverAccountModalStack;
