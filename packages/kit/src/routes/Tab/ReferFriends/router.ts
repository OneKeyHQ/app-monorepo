import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabReferFriendsRoutes,
  type ITabReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';

const ReferAFriend = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/ReferAFriend'),
);

const InviteReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/InviteReward'),
);

const YourReferred = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/YourReferred'),
);

const HardwareSalesReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/HardwareSalesReward'),
);

const EarnReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/EarnReward'),
);

const RewardDistributionHistory = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/RewardDistributionHistory'),
);

const ReferralLevel = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/ReferralLevel'),
);

export const referFriendsRouters: ITabSubNavigatorConfig<
  ETabReferFriendsRoutes,
  ITabReferFriendsParamList
>[] = [
  {
    name: ETabReferFriendsRoutes.TabReferAFriend,
    rewrite: '/',
    component: ReferAFriend,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabInviteReward,
    rewrite: '/invite-reward',
    component: InviteReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabYourReferred,
    rewrite: '/your-referred',
    component: YourReferred,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabHardwareSalesReward,
    rewrite: '/hardware-sales-reward',
    component: HardwareSalesReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabEarnReward,
    rewrite: '/earn-reward',
    component: EarnReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabRewardDistributionHistory,
    rewrite: '/reward-distribution-history',
    component: RewardDistributionHistory,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabReferralLevel,
    rewrite: '/referral-level',
    component: ReferralLevel,
    headerShown: !platformEnv.isNative,
  },
];
