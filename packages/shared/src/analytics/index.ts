import analytics from '@react-native-firebase/analytics';

import platformEnv from '../platformEnv';

/**
 * native firebase has inject config at native side, just using it at JS context.
 */

export const analyticLogEvent = (
  eventName: string,
  eventParams?: {
    [key: string]: any;
  },
) => {
  /** native only inject firebase config at production with CFBundleVersion not 1 */
  if (!platformEnv.isProduction && process.env.BUILD_NUMBER !== '1') return;
  return analytics().logEvent(eventName, eventParams);
};
