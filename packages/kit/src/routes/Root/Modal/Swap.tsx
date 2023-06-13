import { useIsVerticalLayout } from '@onekeyhq/components';

import CustomToken from '../../../views/ManageTokens/CustomToken';
import ChainSelector from '../../../views/Swap/ChainSelector';
import EnterAddress from '../../../views/Swap/EnterAddress';
import HardwareContinue from '../../../views/Swap/HardwareContinue';
import Input from '../../../views/Swap/Input';
import LimitOrderDetails from '../../../views/Swap/LimitOrderDetails';
import LimitOrderInput from '../../../views/Swap/LimitOrderInput';
import LimitOrderOutput from '../../../views/Swap/LimitOrderOutput';
import Output from '../../../views/Swap/Output';
import OutputCrosschain from '../../../views/Swap/OutputCrosschain';
import PickAccount from '../../../views/Swap/PickAccount';
import PickRecipient from '../../../views/Swap/PickRecipient';
import SelectRoutes from '../../../views/Swap/SelectRoutes';
import Settings from '../../../views/Swap/Settings';
import Share from '../../../views/Swap/Share';
import Slippage from '../../../views/Swap/Slippage';
import SlippageCheck from '../../../views/Swap/SlippageCheck';
import SwftcHelp from '../../../views/Swap/SwftcHelp';
import Transaction from '../../../views/Swap/Transaction';
import TransactionSubmitted from '../../../views/Swap/TransactionSubmitted';
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
    name: SwapRoutes.Slippage,
    component: Slippage,
  },
  {
    name: SwapRoutes.SlippageCheck,
    component: SlippageCheck,
  },
  {
    name: SwapRoutes.LimitOrderInput,
    component: LimitOrderInput,
  },
  {
    name: SwapRoutes.LimitOrderOutput,
    component: LimitOrderOutput,
  },
  {
    name: SwapRoutes.LimitOrderDetails,
    component: LimitOrderDetails,
  },
  {
    name: SwapRoutes.TransactionSubmitted,
    component: TransactionSubmitted,
  },
  {
    name: SwapRoutes.HardwareContinue,
    component: HardwareContinue,
  },
  {
    name: SwapRoutes.ChainSelector,
    component: ChainSelector,
  },
  {
    name: SwapRoutes.OutputCrosschain,
    component: OutputCrosschain,
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
