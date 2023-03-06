import { useIsVerticalLayout } from '@onekeyhq/components';
import RecoverAccountsAdvanced from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccountsAdvanced';

import { RecoverAccountModalRoutes } from '../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export { RecoverAccountModalRoutes };

type RecoverAccountsAdvancedParams = {
  fromIndex: number;
  generateCount?: number;
  networkId?: string;
};

export type RecoverAccountRoutesParams = {
  [RecoverAccountModalRoutes.RecoverAccountsAdvanced]: RecoverAccountsAdvancedParams & {
    onApply: (options: RecoverAccountsAdvancedParams) => void;
  };
};

const RecoverAccountNavigator =
  createStackNavigator<RecoverAccountRoutesParams>();

const modalRoutes = [
  {
    name: RecoverAccountModalRoutes.RecoverAccountsAdvanced,
    component: RecoverAccountsAdvanced,
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
