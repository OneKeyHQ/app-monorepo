import Axios from 'axios';

import platformEnv from '../platformEnv';

import { getDeviceInfo } from './deviceInfo';

import type { AxiosInstance } from 'axios';

class Analytics {
  private instanceId = '';

  private baseURL = '';

  private cacheEvents = [] as [string, Record<string, any> | undefined][];

  private request: AxiosInstance | null = null;

  private basicInfo = {} as {
    screenName: string;
  };

  private deviceInfo: Record<string, any> | null = null;

  setBasicAttributes({
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

  private lazyAxios() {
    if (!this.request) {
      this.request = Axios.create({
        baseURL: this.baseURL,
        timeout: 30 * 1000,
      });
    }
    return this.request;
  }

  trackEvent(eventName: string, eventProps?: Record<string, any>) {
    if (!this.instanceId || !this.baseURL) {
      this.cacheEvents.push([eventName, eventProps]);
    } else {
      void this.requestEvent(eventName, {
        distinctId: this.instanceId,
        eventProps,
      });
    }
  }

  private async lazyDeviceInfo() {
    if (!this.deviceInfo) {
      this.deviceInfo = await getDeviceInfo();
      this.deviceInfo.appBuildNumber = platformEnv.buildNumber;
      this.deviceInfo.appVersion = platformEnv.version;
    }
    this.deviceInfo.screenName = this.basicInfo.screenName;
    return this.deviceInfo;
  }

  private async requestEvent(
    eventName: string,
    eventProps?: Record<string, any>,
  ) {
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
      eventProps: event,
    });
  }
}

export const analytics = new Analytics();
