import { initializeApp } from '@firebase/app';

import platformEnv from '../platformEnv';

import firebaseConfig from './firebase.web.json';

import type {
  getAnalytics as getAnalyticsType,
  logEvent as logEventType,
} from '@firebase/analytics';

const { getAnalytics, logEvent } =
  require('../../../../node_modules/@firebase/analytics/dist/esm/index.esm') as {
    getAnalytics: typeof getAnalyticsType;
    logEvent: typeof logEventType;
  };

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
  if (!platformEnv.isProduction || !firebaseConfig.apiKey) {
    return;
  }
  return logEvent(getAnalyticsInstance(), eventName, eventParams);
};
