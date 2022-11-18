import InAppReview from 'react-native-in-app-review';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

export const openAppReview = async () => {
  const isAvailable = InAppReview.isAvailable();
  debugLogger.common.info(
    'react-native-in-app-review is available',
    isAvailable,
  );
  if (!isAvailable) {
    return;
  }
  const lastOpenedAt = await simpleDb.setting.getAppReviewsLastOpenedAt();
  if (lastOpenedAt > 0) {
    return;
  }
  let hasFlowFinishedSuccessfully = false;
  try {
    hasFlowFinishedSuccessfully = await InAppReview.RequestInAppReview();
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    debugLogger.common.info('react-native-in-app-review error', e.message);
    return;
  }
  await simpleDb.setting.setAppReviewsLastOpenedAt(Date.now());
  debugLogger.common.info(
    'hasFlowFinishedSuccessfully',
    hasFlowFinishedSuccessfully,
  );
};
