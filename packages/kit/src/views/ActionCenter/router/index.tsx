import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IActionCenterParamList } from '@onekeyhq/shared/src/routes/fullScreenPush';
import { EActionCenterPages } from '@onekeyhq/shared/src/routes/fullScreenPush';

const ActionCenter = LazyLoadPage(() => import('../pages/ActionCenter'));

// On iOS 26 the page renders the native Liquid Glass nav bar (via Page.Header in
// MoreActionContentHeader). Reserve that bar at the route level so it is present
// from the very first frame. Otherwise the route mounts headerless and the
// in-page Page.Header flips headerShown false->true one layout pass later, which
// inserts the opaque (non-transparent) bar and pushes Page.Body down — the
// visible "slide down from top" on entry. The in-page Page.Header still runs and
// just populates the already-shown bar's right items (no vertical shift). iOS <26
// / Android / web / desktop / ext keep the self-drawn header (headerShown false).
const headerOptions = {
  headerShown: platformEnv.isNativeIOS26Plus,
};

export const ActionCenterRouter: IModalFlowNavigatorConfig<
  EActionCenterPages,
  IActionCenterParamList
>[] = [
  {
    name: EActionCenterPages.ActionCenter,
    component: ActionCenter,
    options: headerOptions,
  },
];
