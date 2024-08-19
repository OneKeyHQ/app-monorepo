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

  init({ instanceId, baseURL }: { instanceId: string; baseURL: string }) {
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
      void this.requestEvent(eventName, eventProps);
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
    if (platformEnv.isDev || platformEnv.isE2E) {
      return;
    }
    const event = {
      ...eventProps,
      distinct_id: this.instanceId,
      ...(await this.lazyDeviceInfo()),
    } as Record<string, string>;
    if (
      !platformEnv.isNative &&
      typeof window !== 'undefined' &&
      'location' in window
    ) {
      event.currentUrl = window.location.href;
    }
    const axios = this.lazyAxios();
    await axios.post('/utility/v1/track/event', {
      eventName,
      eventProps: event,
    });
  }

  private async requestUserProfile(attributes: Record<string, any>) {
    if (platformEnv.isDev || platformEnv.isE2E) {
      return;
    }
    const axios = this.lazyAxios();
    await axios.post('/utility/v1/track/attributes', {
      distinctId: this.instanceId,
      attributes: {
        ...attributes,
        ...(await this.lazyDeviceInfo()),
      },
    });
  }

  public updateUserProfile(attributes: {
    walletCount?: number;
    appWalletCount?: number;
    hwWalletCount?: number;
  }) {
    void this.requestUserProfile(attributes);
  }
}

export const analytics = new Analytics();
