import { CustomNetwork } from '@onekeyhq/kit/src/views/ManageNetworks/CustomNetwork';
import { Listing } from '@onekeyhq/kit/src/views/ManageNetworks/Listing';
import { SortableView } from '@onekeyhq/kit/src/views/ManageNetworks/Listing/SortableView';
import { PresetNetwork } from '@onekeyhq/kit/src/views/ManageNetworks/PresetNetwork';
import { ManageNetworkRPCNode } from '@onekeyhq/kit/src/views/ManageNetworks/RPCNode';
import type { ManageNetworkRoutesParams } from '@onekeyhq/kit/src/views/ManageNetworks/types';
import { ManageNetworkRoutes } from '@onekeyhq/kit/src/views/ManageNetworks/types';

import { NetworkAccountSelectorModal } from '../../components/NetworkAccountSelector';
import { NetworkSelectorModal } from '../../components/NetworkAccountSelector/modals/NetworkSelectorModal/NetworkSelectorModal';
import { createLazyComponent } from '../../utils/createLazyComponent';
import { AddNetworkConfirm } from '../../views/ManageNetworks/AddNetwork/AddNetworkConfirm';
import { ManageNetworkQuickAdd } from '../../views/ManageNetworks/QuickAdd';
import { SwitchNetwork } from '../../views/ManageNetworks/SwitchNetwork';

const manageNetworkModals = [
  {
    name: ManageNetworkRoutes.NetworkAccountSelector,
    component: NetworkAccountSelectorModal,
  },
  {
    name: ManageNetworkRoutes.NetworkSelector,
    component: NetworkSelectorModal,
  },
  {
    name: ManageNetworkRoutes.Listing,
    component: Listing,
  },
  {
    name: ManageNetworkRoutes.AddNetwork,
    component: createLazyComponent(
      () => import('@onekeyhq/kit/src/views/ManageNetworks/AddNetwork'),
    ),
  },
  {
    name: ManageNetworkRoutes.CustomNetwork,
    component: CustomNetwork,
  },
  {
    name: ManageNetworkRoutes.PresetNetwork,
    component: PresetNetwork,
  },
  {
    name: ManageNetworkRoutes.AddNetworkConfirm,
    component: AddNetworkConfirm,
  },
  {
    name: ManageNetworkRoutes.SwitchNetwork,
    component: SwitchNetwork,
  },
  {
    name: ManageNetworkRoutes.RPCNode,
    component: ManageNetworkRPCNode,
  },
  {
    name: ManageNetworkRoutes.QuickAdd,
    component: ManageNetworkQuickAdd,
  },
  {
    name: ManageNetworkRoutes.Sort,
    component: SortableView,
  },
];
export default manageNetworkModals;
export { ManageNetworkRoutes };
export type { ManageNetworkRoutesParams };
