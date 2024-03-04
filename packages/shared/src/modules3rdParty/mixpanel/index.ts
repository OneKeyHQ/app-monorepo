import platformEnv from '../../platformEnv';

import { getMixpanel } from './mixpanel';

const basicInfo = {} as {
  screen_name: string;
};

export enum ETrackEventNames {
  PageView = 'page_view',
  AppStart = 'AppStart',
  EnterDapp = 'EnterDapp',
  DeleteWallet = 'DeleteWallet',
  CreateWallet = 'CreateWallet',
  ImportWallet = 'ImportWallet',
}

const asyncTrackEvent = async (
  eventName: string,
  eventProps?: Record<string, any>,
) => {
  const mixpanel = await getMixpanel();
  mixpanel?.track(eventName, eventProps);
};

export const trackEvent = (
  eventName: ETrackEventNames,
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

export const trackPage = (pageName: string) => {
  basicInfo.screen_name = pageName;
  trackEvent(ETrackEventNames.PageView, { pageName });
};

const asyncIdentify = async (distinctId: string) => {
  const mixpanel = await getMixpanel();
  mixpanel?.identify(distinctId);
};

export const identify = (distinctId: string) => {
  void asyncIdentify(distinctId);
};
