import Axios from 'axios';

import platformEnv from '../platformEnv';

import { getDeviceInfo } from './deviceInfo';

import type { AxiosInstance } from 'axios';

export enum ETrackEventNames {
  PageView = 'pageView',
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

const basicInfo = {} as {
  screenName: string;
};

let deviceInfo: Record<string, any> | null = null;
const lazyDeviceInfo = async () => {
  if (!deviceInfo) {
    deviceInfo = await getDeviceInfo();
    deviceInfo.appBuildNumber = platformEnv.buildNumber;
    deviceInfo.appVersion = platformEnv.version;
  }
  deviceInfo.screenName = basicInfo.screenName;
  return deviceInfo;
};

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
  const event = {
    ...eventProps,
    ...(await lazyDeviceInfo()),
  };
  if (platformEnv.isDev) {
    console.log('trackEvent', event);
    return;
  }
  const axios = lazyAxios();
  await axios.post('/api/track-event', {
    eventName,
    event,
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
  void requestEvent(eventName, {
    distinctId,
    eventProps,
  });
}

export const trackPage = (pageName: string) => {
  basicInfo.screenName = pageName;
  trackEvent(ETrackEventNames.PageView, { pageName });
};

export const identify = (instanceId: string) => {
  distinctId = instanceId;
};
