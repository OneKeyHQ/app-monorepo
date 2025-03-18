import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

const ReferFriends = LazyLoadPage(() => import('../pages/ReferAFriend'));
const YourReferred = LazyLoadPage(() => import('../pages/YourReferred'));
const HardwareSalesReward = LazyLoadPage(
  () => import('../pages/HardwareSalesReward'),
);

export const ReferFriendsRouter: IModalFlowNavigatorConfig<
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList
>[] = [
  {
    name: EModalReferFriendsRoutes.ReferAFriend,
    component: ReferFriends,
  },
  {
    name: EModalReferFriendsRoutes.YourReferred,
    component: YourReferred,
  },
  {
    name: EModalReferFriendsRoutes.HardwareSalesReward,
    component: HardwareSalesReward,
  },
];
