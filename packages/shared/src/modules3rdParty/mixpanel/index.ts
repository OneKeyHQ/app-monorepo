import { getMixpanel } from './mixpanel';

const asyncTrackPage = async (pageName: string) => {
  const mixpanel = await getMixpanel();
  mixpanel?.track('page_view', { pageName });
};

const basicInfo = {} as {
  screen_name: string;
};

export const trackPage = (pageName: string) => {
  basicInfo.screen_name = pageName;
  void asyncTrackPage(pageName);
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
  void asyncTrackEvent(eventName, {
    ...basicInfo,
    eventProps,
  });
};
