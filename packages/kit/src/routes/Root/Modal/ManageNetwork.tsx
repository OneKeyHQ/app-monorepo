import { useIsVerticalLayout } from '@onekeyhq/components';

import { NetworkAccountSelectorModal } from '../../../components/NetworkAccountSelector';
import { NetworkSelectorModal } from '../../../components/NetworkAccountSelector/modals/NetworkSelectorModal/NetworkSelectorModal';
import { AddNetwork } from '../../../views/ManageNetworks/AddNetwork';
import { AddNetworkConfirm } from '../../../views/ManageNetworks/AddNetwork/AddNetworkConfirm';
import { CustomNetwork } from '../../../views/ManageNetworks/CustomNetwork';
import { Listing } from '../../../views/ManageNetworks/Listing';
import { SortableView } from '../../../views/ManageNetworks/Listing/SortableView';
import { PresetNetwork } from '../../../views/ManageNetworks/PresetNetwork';
import { ManageNetworkQuickAdd } from '../../../views/ManageNetworks/QuickAdd';
import { ManageNetworkRPCNode } from '../../../views/ManageNetworks/RPCNode';
import { SwitchNetwork } from '../../../views/ManageNetworks/SwitchNetwork';
import { SwitchRpcModal } from '../../../views/ManageNetworks/SwitchRpc';
import { ManageNetworkModalRoutes } from '../../../views/ManageNetworks/types';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { ManageNetworkRoutesParams } from '../../../views/ManageNetworks/types';

const ManageNetworkNavigator =
  createStackNavigator<ManageNetworkRoutesParams>();

const modalRoutes = [
  {
    name: ManageNetworkModalRoutes.NetworkAccountSelector,
    component: NetworkAccountSelectorModal,
  },
  {
    name: ManageNetworkModalRoutes.NetworkSelector,
    component: NetworkSelectorModal,
  },
  {
    name: ManageNetworkModalRoutes.Listing,
    component: Listing,
  },
  {
    name: ManageNetworkModalRoutes.AddNetwork,
    component: AddNetwork,
  },
  {
    name: ManageNetworkModalRoutes.CustomNetwork,
    component: CustomNetwork,
  },
  {
    name: ManageNetworkModalRoutes.PresetNetwork,
    component: PresetNetwork,
  },
  {
    name: ManageNetworkModalRoutes.AddNetworkConfirm,
    component: AddNetworkConfirm,
  },
  {
    name: ManageNetworkModalRoutes.SwitchNetwork,
    component: SwitchNetwork,
  },
  {
    name: ManageNetworkModalRoutes.RPCNode,
    component: ManageNetworkRPCNode,
  },
  {
    name: ManageNetworkModalRoutes.QuickAdd,
    component: ManageNetworkQuickAdd,
  },
  {
    name: ManageNetworkModalRoutes.Sort,
    component: SortableView,
  },
  {
    name: ManageNetworkModalRoutes.SwitchRpc,
    component: SwitchRpcModal,
  },
];

const ManageNetworkModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageNetworkNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <ManageNetworkNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageNetworkNavigator.Navigator>
  );
};

export default ManageNetworkModalStack;
export type { ManageNetworkRoutesParams };
