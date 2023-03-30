import { useIsVerticalLayout } from '@onekeyhq/components';

import CustomToken from '../../../views/ManageTokens/CustomToken';
import EnterAddress from '../../../views/Swap/EnterAddress';
import Input from '../../../views/Swap/Input';
import Output from '../../../views/Swap/Output';
import PickAccount from '../../../views/Swap/PickAccount';
import PickRecipient from '../../../views/Swap/PickRecipient';
import SelectRoutes from '../../../views/Swap/SelectRoutes';
import Send from '../../../views/Swap/Send';
import Settings from '../../../views/Swap/Settings';
import Share from '../../../views/Swap/Share';
import Slippage from '../../../views/Swap/Slippage';
import SlippageCheck from '../../../views/Swap/SlippageCheck';
import SwftcHelp from '../../../views/Swap/SwftcHelp';
import Transaction from '../../../views/Swap/Transaction';
import { SwapRoutes } from '../../../views/Swap/typings';
import Webview from '../../../views/Swap/Webview';
import Welcome from '../../../views/Swap/Welcome';

import createStackNavigator from './createStackNavigator';

import type { SwapRoutesParams } from '../../../views/Swap/typings';

const SwapNavigator = createStackNavigator<SwapRoutesParams>();

const modalRoutes = [
  {
    name: SwapRoutes.Input,
    component: Input,
  },
  {
    name: SwapRoutes.Output,
    component: Output,
  },
  {
    name: SwapRoutes.Settings,
    component: Settings,
  },
  {
    name: SwapRoutes.CustomToken,
    component: CustomToken,
  },
  {
    name: SwapRoutes.Transaction,
    component: Transaction,
  },
  {
    name: SwapRoutes.Webview,
    component: Webview,
  },
  {
    name: SwapRoutes.SwftcHelp,
    component: SwftcHelp,
  },
  {
    name: SwapRoutes.Share,
    component: Share,
  },
  {
    name: SwapRoutes.PickRecipient,
    component: PickRecipient,
  },
  {
    name: SwapRoutes.PickAccount,
    component: PickAccount,
  },
  {
    name: SwapRoutes.EnterAddress,
    component: EnterAddress,
  },
  {
    name: SwapRoutes.Welcome,
    component: Welcome,
  },
  {
    name: SwapRoutes.SelectRoutes,
    component: SelectRoutes,
  },
  {
    name: SwapRoutes.Send,
    component: Send,
  },
  {
    name: SwapRoutes.Slippage,
    component: Slippage,
  },
  {
    name: SwapRoutes.SlippageCheck,
    component: SlippageCheck,
  },
];

const SwapModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SwapNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SwapNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SwapNavigator.Navigator>
  );
};

export default SwapModalStack;
