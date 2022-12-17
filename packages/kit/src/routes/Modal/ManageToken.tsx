import { useIsVerticalLayout } from '@onekeyhq/components';

import {
  AddToken,
  CustomToken,
  Listing,
  VerifiedToken,
  ViewTokenModal,
} from '../../views/ManageTokens';
import ActivateTokenAuthModal from '../../views/ManageTokens/ActivateTokenAuthModal';
import TokenRiskDetail from '../../views/ManageTokens/RiskDetail';
import { ManageTokenRoutes } from '../../views/ManageTokens/types';
import { PriceAlertAddModal } from '../../views/PushNotification/PriceAlertAddModal';
import { PriceAlertListModal } from '../../views/PushNotification/PriceAlertListModal';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { ManageTokenRoutesParams } from '../../views/ManageTokens/types';

const ManageTokenNavigator = createStackNavigator<ManageTokenRoutesParams>();

const modalRoutes = [
  {
    name: ManageTokenRoutes.Listing,
    component: Listing,
  },
  {
    name: ManageTokenRoutes.AddToken,
    component: AddToken,
  },
  {
    name: ManageTokenRoutes.ActivateToken,
    component: ActivateTokenAuthModal,
  },
  {
    name: ManageTokenRoutes.ViewToken,
    component: ViewTokenModal,
  },
  {
    name: ManageTokenRoutes.CustomToken,
    component: CustomToken,
  },
  {
    name: ManageTokenRoutes.VerifiedToken,
    component: VerifiedToken,
  },
  {
    name: ManageTokenRoutes.PriceAlertList,
    component: PriceAlertListModal,
  },
  {
    name: ManageTokenRoutes.PriceAlertAdd,
    component: PriceAlertAddModal,
  },
  {
    name: ManageTokenRoutes.TokenRiskDetail,
    component: TokenRiskDetail,
  },
];

const ManageTokenModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageTokenNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <ManageTokenNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageTokenNavigator.Navigator>
  );
};

export default ManageTokenModalStack;
export { ManageTokenRoutes };
export type { ManageTokenRoutesParams };
