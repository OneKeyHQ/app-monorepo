import platformEnv from '../platformEnv';

/**
 * native firebase has inject config at native side, just using it at JS context.
 */

export const analyticLogEvent = async (
  eventName: string,
  eventParams?: {
    [key: string]: any;
  },
) => {
  if (!platformEnv.isProduction) {
    return;
  }
  const module = await import('@react-native-firebase/analytics');
  return module.firebase.analytics().logEvent(eventName, eventParams);
};
