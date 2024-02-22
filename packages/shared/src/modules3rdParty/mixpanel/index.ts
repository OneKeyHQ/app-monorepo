import platformEnv from '../../platformEnv';

import { getMixpanel } from './mixpanel';

const basicInfo = {} as {
  screen_name: string;
};

const asyncTrackEvent = async (
  eventName: string,
  eventProps?: Record<string, any>,
) => {
  const mixpanel = await getMixpanel();
  mixpanel?.track(eventName, eventProps);
};

export const trackEvent = (
  eventName: string,
  eventProps?: Record<string, any>,
) => {
  if (platformEnv.isDev) {
    return;
  }
  void asyncTrackEvent(eventName, {
    ...basicInfo,
    eventProps,
  });
};

const asyncTrackPage = async (pageName: string) => {
  trackEvent('page_view', { pageName });
};

export const trackPage = (pageName: string) => {
  basicInfo.screen_name = pageName;
  void asyncTrackPage(pageName);
};

const asyncIdentify = async (distinctId: string) => {
  const mixpanel = await getMixpanel();
  mixpanel?.identify(distinctId);
};

export const identify = (distinctId: string) => {
  void asyncIdentify(distinctId);
};
