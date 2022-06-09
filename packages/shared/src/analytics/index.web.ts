import { getAnalytics, logEvent } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';

import platformEnv from '../platformEnv';

import firebaseConfig from './firebase.web.json';

const getAnalyticsInstance = () => {
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  return analytics;
};

export const analyticLogEvent = (
  eventName: string,
  eventParams?: {
    [key: string]: any;
  },
) => {
  if (
    !platformEnv.isProduction ||
    !firebaseConfig.apiKey ||
    platformEnv.isExtension
  )
    return;
  return logEvent(getAnalyticsInstance(), eventName, eventParams);
};
