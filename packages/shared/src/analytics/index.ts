import Axios from 'axios';

import {
  EWebEmbedPostMessageType,
  postMessage,
} from '@onekeyhq/shared/src/modules3rdParty/webEmebd/postMessage';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import { headerPlatform } from '../request/InterceptorConsts';

import { getDeviceInfo } from './deviceInfo';

import type { AxiosInstance } from 'axios';

export const ANALYTICS_EVENT_PATH = '/utility/v1/track';

const TRACK_EVENT_PATH = `${ANALYTICS_EVENT_PATH}/event`;
const TRACK_ATTRIBUTES_PATH = `${ANALYTICS_EVENT_PATH}/attributes`;

export class Analytics {
  private instanceId = '';

  private baseURL = '';

  private cacheEvents = [] as [string, Record<string, any> | undefined][];

  private cacheUserProfile = [] as Record<string, any>[];

  private request: AxiosInstance | null = null;

  private basicInfo = {} as {
    pageName: string;
  };

  private deviceInfo: Record<string, any> | null = null;

  private enableAnalyticsInDev = false;

  init({
    instanceId,
    baseURL,
    enableAnalyticsInDev = false,
  }: {
    instanceId: string;
    baseURL: string;
    enableAnalyticsInDev?: boolean;
  }) {
    this.instanceId = instanceId;
    this.baseURL = baseURL;
    this.enableAnalyticsInDev = enableAnalyticsInDev;
    while (this.cacheEvents.length) {
      const params = this.cacheEvents.pop();
      if (params) {
        const [eventName, eventProps] = params;
        this.trackEvent(eventName as any, eventProps);
      }
    }
    while (this.cacheUserProfile.length) {
      const attributes = this.cacheUserProfile.pop();
      if (attributes) {
        this.updateUserProfile(attributes);
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
    if (eventProps?.pageName) {
      this.basicInfo.pageName = eventProps.pageName;
    }
    if (this.instanceId && this.baseURL) {
      if (platformEnv.isWebEmbed) {
        postMessage({
          type: EWebEmbedPostMessageType.TrackEvent,
          data: {
            eventName,
            eventProps,
          },
        });
      } else {
        void this.requestEvent(eventName, eventProps);
      }
    } else {
      this.cacheEvents.push([eventName, eventProps]);
    }
  }

  private async lazyDeviceInfo() {
    if (!this.deviceInfo) {
      this.deviceInfo = await getDeviceInfo();
      this.deviceInfo.platform = headerPlatform;
      this.deviceInfo.appBuildNumber = platformEnv.buildNumber;
      this.deviceInfo.appVersion = platformEnv.version;
    }
    this.deviceInfo.pageName = this.basicInfo.pageName;
    return this.deviceInfo;
  }

  private async requestEvent(
    eventName: string,
    eventProps?: Record<string, any>,
  ) {
    if (
      (platformEnv.isDev || platformEnv.isE2E) &&
      !this.enableAnalyticsInDev
    ) {
      return;
    }
    const deviceInfo = await this.lazyDeviceInfo();
    const event = {
      ...deviceInfo,
      ...eventProps,
      distinct_id: this.instanceId,
    } as Record<string, string>;
    if (
      !platformEnv.isNative &&
      // eslint-disable-next-line unicorn/prefer-global-this
      typeof window !== 'undefined' &&
      // eslint-disable-next-line unicorn/prefer-global-this
      'location' in window
    ) {
      event.currentUrl = globalThis.location.href;
    }
    const axios = this.lazyAxios();
    await axios.post(TRACK_EVENT_PATH, {
      eventName,
      eventProps: event,
    });
  }

  private async requestUserProfile(attributes: Record<string, any>) {
    if (
      (platformEnv.isDev || platformEnv.isE2E) &&
      !this.enableAnalyticsInDev
    ) {
      return;
    }
    const axios = this.lazyAxios();
    await axios.post(TRACK_ATTRIBUTES_PATH, {
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
    if (this.instanceId && this.baseURL) {
      void this.requestUserProfile(attributes);
    } else {
      this.cacheUserProfile.push(attributes);
    }
  }
}

export const analytics = new Analytics();
appGlobals.$analytics = analytics;
