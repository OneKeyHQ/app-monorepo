import Axios from 'axios';

import platformEnv from '../platformEnv';

import type { AxiosInstance } from 'axios';

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

export interface ITrackPayload {
  [ETrackEventNames.PageView]: { pageName: string };
  [ETrackEventNames.AppStart]: undefined;
  [ETrackEventNames.EnterDapp]: {
    dapp_url: string;
    dapp_title?: string;
    is_favorite: boolean;
  };
  [ETrackEventNames.DeleteWallet]: undefined;
  [ETrackEventNames.CreateWallet]: {
    is_biometric_verification_set: boolean;
  };
  [ETrackEventNames.ImportWallet]: {
    import_method: string;
  };
}

let distinctId = '';
let request: AxiosInstance | null = null;
const lazyAxios = () => {
  if (!request) {
    request = Axios.create({
      baseURL: 'https://api.mintscan.io',
      timeout: 30 * 1000,
    });
  }
  return request;
};

const requestEvent = async (
  eventName: string,
  eventProps?: Record<string, any>,
) => {
  const axios = lazyAxios();
  await axios.post('/api/track-event', {
    eventName,
    eventProps,
  });
};

const requestUpdateAttributes = async (attributes?: Record<string, any>) => {
  const axios = lazyAxios();
  await axios.post('/api/update-attributes', {
    distinctId,
    attributes,
  });
};

export const updateUserAttributes = (attributes?: Record<string, any>) => {
  void requestUpdateAttributes(attributes);
};

export function trackEvent<T extends ETrackEventNames>(
  eventName: T,
  eventProps?: ITrackPayload[T],
) {
  if (platformEnv.isDev) {
    return;
  }
  void requestEvent(eventName, {
    ...basicInfo,
    eventProps,
  });
}

export const trackPage = (pageName: string) => {
  basicInfo.screen_name = pageName;
  trackEvent(ETrackEventNames.PageView, { pageName });
};

export const identify = (instanceId: string) => {
  distinctId = instanceId;
};
