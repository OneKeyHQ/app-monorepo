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

class Analytics {
  private instanceId = '';

  private baseURL = '';

  private cacheEvents = [] as [string, Record<string, any> | undefined][];

  private request: AxiosInstance | null = null;

  private basicInfo = {} as {
    screenName: string;
  };

  private deviceInfo: Record<string, any> | null = null;

  setBaseInfo({
    instanceId,
    baseURL,
  }: {
    instanceId: string;
    baseURL: string;
  }) {
    this.instanceId = instanceId;
    this.baseURL = baseURL;
    while (this.cacheEvents.length) {
      const params = this.cacheEvents.pop();
      if (params) {
        const [eventName, eventProps] = params;
        this.trackEvent(eventName as any, eventProps);
      }
    }
  }

  lazyAxios() {
    if (!this.request) {
      this.request = Axios.create({
        baseURL: this.baseURL,
        timeout: 30 * 1000,
      });
    }
    return this.request;
  }

  trackPage(pageName: string) {
    this.basicInfo.screenName = pageName;
    this.trackEvent(ETrackEventNames.PageView, { pageName });
  }

  trackEvent<T extends ETrackEventNames>(
    eventName: T,
    eventProps?: ITrackPayload[T],
  ) {
    if (!this.instanceId || !this.baseURL) {
      this.cacheEvents.push([eventName, eventProps]);
    } else {
      void this.requestEvent(eventName, {
        distinctId: this.instanceId,
        eventProps,
      });
    }
  }

  async lazyDeviceInfo() {
    if (!this.deviceInfo) {
      this.deviceInfo = await getDeviceInfo();
      this.deviceInfo.appBuildNumber = platformEnv.buildNumber;
      this.deviceInfo.appVersion = platformEnv.version;
    }
    this.deviceInfo.screenName = this.basicInfo.screenName;
    return this.deviceInfo;
  }

  async requestEvent(eventName: string, eventProps?: Record<string, any>) {
    const event = {
      ...eventProps,
      ...(await this.lazyDeviceInfo()),
    };
    // if (platformEnv.isDev) {
    //   console.log('trackEvent', event);
    //   return;
    // }
    const axios = this.lazyAxios();
    await axios.post('/utility/v1/track/event', {
      eventName,
      event,
    });
  }
}

export const analytics = new Analytics();
