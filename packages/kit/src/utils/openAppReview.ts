import InAppReview from 'react-native-in-app-review';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const canShowAppReview = async (unlimitedTimes?: boolean) => {
  const isAvailable = InAppReview.isAvailable();
  debugLogger.common.info(
    'react-native-in-app-review is available',
    isAvailable,
  );
  if (!isAvailable) {
    return false;
  }
  const appRatingsEnabled =
    await backgroundApiProxy.serviceSetting.getEnableAppRatings();
  const lastOpenedAt =
    await backgroundApiProxy.serviceSetting.getAppReviewsLastOpenedAt();
  debugLogger.common.info(
    'appRatingsEnabled, ',
    appRatingsEnabled,
    'lastOpenedAt, ',
    lastOpenedAt,
  );
  if ((!unlimitedTimes && lastOpenedAt > 0) || !appRatingsEnabled) {
    return false;
  }
  return true;
};

export const openAppReview = async (unlimitedTimes?: boolean) => {
  if (!(await canShowAppReview(unlimitedTimes))) {
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
  backgroundApiProxy.serviceSetting.setAppReviewsLastOpenedAt(Date.now());
  debugLogger.common.info(
    'hasFlowFinishedSuccessfully',
    hasFlowFinishedSuccessfully,
  );
};
