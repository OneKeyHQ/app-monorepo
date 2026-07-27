import Axios from 'axios';

import {
  EWebEmbedPostMessageType,
  postMessage,
} from '@onekeyhq/shared/src/modules3rdParty/webEmebd/postMessage';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import { headerPlatform } from '../request/InterceptorConsts';

import { getDeviceInfo } from './deviceInfo';
import { type TAnalyticsTier, getAnalyticsTier } from './tier';

import type { IAnalyticsUserProfile } from './type';
import type { AxiosInstance } from 'axios';

export const ANALYTICS_EVENT_PATH = '/utility/v1/track';

const TRACK_EVENT_PATH = `${ANALYTICS_EVENT_PATH}/event`;
const TRACK_ATTRIBUTES_PATH = `${ANALYTICS_EVENT_PATH}/attributes`;

type IAnalyticsDeviceInfo = Record<string, unknown> & {
  tier: TAnalyticsTier;
};

export class Analytics {
  private instanceId = '';

  private baseURL = '';

  private cacheEvents = [] as [string, Record<string, any> | undefined][];

  private cacheUserProfile = [] as IAnalyticsUserProfile[];

  private request: AxiosInstance | null = null;

  private basicInfo = {} as {
    pageName: string;
  };

  private deviceInfoPromise: Promise<IAnalyticsDeviceInfo> | null = null;

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

  private async lazyAxios() {
    if (!this.request) {
      const baseConfig = {
        baseURL: this.baseURL,
        timeout: 30 * 1000,
      };

      // Lazy load IP Table adapter to avoid circular dependencies in tests
      let ipTableAdapter;
      try {
        const { isSupportIpTablePlatform } =
          await import('../utils/ipTableUtils');
        if (isSupportIpTablePlatform()) {
          const { createIpTableAdapter } =
            await import('../request/helpers/ipTableAdapter');
          ipTableAdapter = createIpTableAdapter(baseConfig);
        }
      } catch (error) {
        // Ignore errors in test environment or when modules are not available
        console.warn('[Analytics] Failed to load IP Table adapter:', error);
      }

      this.request = Axios.create({
        ...baseConfig,
        adapter: ipTableAdapter,
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

  private async lazyDeviceInfo(): Promise<IAnalyticsDeviceInfo> {
    let deviceInfoPromise = this.deviceInfoPromise;
    if (!deviceInfoPromise) {
      deviceInfoPromise = (async () => {
        const deviceInfo = await getDeviceInfo();
        const { getDeviceCpuTier } =
          await import('../performance/devicePerformanceTier');
        return {
          ...deviceInfo,
          tier: getAnalyticsTier(getDeviceCpuTier()),
          platform: headerPlatform,
          appBuildNumber: platformEnv.buildNumber,
          appVersion: platformEnv.version,
        };
      })().catch((error) => {
        this.deviceInfoPromise = null;
        throw error;
      });
      this.deviceInfoPromise = deviceInfoPromise;
    }
    const deviceInfo = await deviceInfoPromise;
    return {
      ...deviceInfo,
      pageName: this.basicInfo.pageName,
    };
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
      tier: deviceInfo.tier,
      distinct_id: this.instanceId,
    } as Record<string, unknown>;
    if (
      !platformEnv.isNative &&
      // eslint-disable-next-line unicorn/prefer-global-this
      typeof window !== 'undefined' &&
      // eslint-disable-next-line unicorn/prefer-global-this
      'location' in window
    ) {
      event.currentUrl = globalThis.location.href;
    }
    const axios = await this.lazyAxios();
    await axios.post(TRACK_EVENT_PATH, {
      eventName,
      eventProps: event,
    });
  }

  private async requestUserProfile(attributes: IAnalyticsUserProfile) {
    if (
      (platformEnv.isDev || platformEnv.isE2E) &&
      !this.enableAnalyticsInDev
    ) {
      return;
    }
    const axios = await this.lazyAxios();
    await axios.post(TRACK_ATTRIBUTES_PATH, {
      distinctId: this.instanceId,
      attributes: {
        ...attributes,
        ...(await this.lazyDeviceInfo()),
      },
    });
  }

  public updateUserProfile(attributes: IAnalyticsUserProfile) {
    if (this.instanceId && this.baseURL) {
      void this.requestUserProfile(attributes);
    } else {
      this.cacheUserProfile.push(attributes);
    }
  }
}

export const analytics = new Analytics();
appGlobals.$analytics = analytics;
