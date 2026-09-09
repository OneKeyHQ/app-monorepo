import { perpsUnifoldDepositTrackingAtom } from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export async function resumeUnifoldDepositTracking(
  backgroundApi: Pick<IBackgroundApi, 'serviceUnifoldDeposit'>,
) {
  const {
    items,
    watches = [],
    pendingDeliveries = [],
  } = await perpsUnifoldDepositTrackingAtom.get();
  if (!items.length && !watches.length && !pendingDeliveries.length) {
    return;
  }
  await backgroundApi.serviceUnifoldDeposit.unifoldDepositTrackingLoop();
}
