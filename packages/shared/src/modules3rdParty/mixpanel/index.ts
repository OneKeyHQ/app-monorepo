import { getMixpanel } from './mixpanel';

const asyncTrackPage = async (pageName: string) => {
  const mixpanel = await getMixpanel();
  mixpanel.track('page_view', { pageName });
};

export const trackPage = (pageName: string) => {
  void asyncTrackPage(pageName);
};

const asyncTrackEvent = async (eventName: string, eventProps?: any) => {
  const mixpanel = await getMixpanel();
  mixpanel.track(eventName, eventProps);
};

export const trackEvent = async (eventName: string, eventProps?: any) => {
  void asyncTrackEvent(eventName, eventProps);
};
