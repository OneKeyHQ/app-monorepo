import Axios from 'axios';

import {
  EWebEmbedPostMessageType,
  postMessage,
} from '@onekeyhq/shared/src/modules3rdParty/webEmebd/postMessage';

import appGlobals from '../appGlobals';
import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';
import { headerPlatform } from '../request/InterceptorConsts';
import { PRIME_REDEEM_LANDING_PATH } from '../routes/tabHome';

import { getDeviceInfo } from './deviceInfo';
import { type TAnalyticsTier, getAnalyticsTier } from './tier';

import type { IAnalyticsUserProfile, IDeviceInfo } from './type';
import type { AxiosInstance } from 'axios';

export const ANALYTICS_EVENT_PATH = '/utility/v1/track';

const TRACK_EVENT_PATH = `${ANALYTICS_EVENT_PATH}/event`;
const TRACK_ATTRIBUTES_PATH = `${ANALYTICS_EVENT_PATH}/attributes`;

type IAnalyticsDeviceInfo = Record<string, unknown> & {
  tier: TAnalyticsTier;
};

export type IAnalyticsReplayContext = {
  sessionId: string;
  // Epoch ms; events tracked at or after this time are not linked.
  expiresAt: number;
};

export class Analytics {
  private instanceId = '';

  private baseURL = '';

  // Third element: replay session id captured when the event was tracked.
  private cacheEvents = [] as [
    string,
    Record<string, any> | undefined,
    string | undefined,
  ][];

  private cacheUserProfile = [] as IAnalyticsUserProfile[];

  private request: AxiosInstance | null = null;

  private basicInfo = {} as {
    pageName: string;
  };

  private deviceInfoPromise: Promise<IAnalyticsDeviceInfo> | null = null;

  private enableAnalyticsInDev = false;

  private initializedWaiters: Array<() => void> = [];

  private replayContext: IAnalyticsReplayContext | null = null;

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
    const waiters = this.initializedWaiters;
    this.initializedWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
    while (this.cacheEvents.length) {
      const params = this.cacheEvents.pop();
      if (params) {
        const [eventName, eventProps, replaySessionId] = params;
        this.dispatchEvent(eventName, eventProps, replaySessionId);
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

  // Links events tracked from this runtime to a sampled Session Replay
  // session. Pass null to stop linking.
  setReplayContext(context: IAnalyticsReplayContext | null) {
    this.replayContext = context
      ? { sessionId: context.sessionId, expiresAt: context.expiresAt }
      : null;
  }

  private captureReplaySessionId(): string | undefined {
    const context = this.replayContext;
    if (!context || Date.now() >= context.expiresAt) {
      return undefined;
    }
    return context.sessionId;
  }

  trackEvent(eventName: string, eventProps?: Record<string, any>) {
    this.dispatchEvent(eventName, eventProps, this.captureReplaySessionId());
  }

  private dispatchEvent(
    eventName: string,
    eventProps: Record<string, any> | undefined,
    replaySessionId: string | undefined,
  ) {
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
        void this.requestEvent(eventName, eventProps, replaySessionId);
      }
    } else {
      this.cacheEvents.push([eventName, eventProps, replaySessionId]);
    }
  }

  async trackEventAsync(
    eventName: string,
    eventProps?: Record<string, any>,
  ): Promise<void> {
    const replaySessionId = this.captureReplaySessionId();
    if (eventProps?.pageName) {
      this.basicInfo.pageName = eventProps.pageName;
    }
    if (!this.instanceId || !this.baseURL) {
      throw new OneKeyLocalError('Analytics is not initialized');
    }
    if (platformEnv.isWebEmbed) {
      postMessage({
        type: EWebEmbedPostMessageType.TrackEvent,
        data: {
          eventName,
          eventProps,
        },
      });
      return;
    }
    await this.requestEvent(eventName, eventProps, replaySessionId);
  }

  private async lazyDeviceInfo(): Promise<IAnalyticsDeviceInfo> {
    let deviceInfoPromise = this.deviceInfoPromise;
    if (!deviceInfoPromise) {
      deviceInfoPromise = (async () => {
        let deviceInfo: IDeviceInfo = {};
        let tier: TAnalyticsTier = 2;

        try {
          deviceInfo = await getDeviceInfo();
        } catch (error) {
          console.warn('[Analytics] Failed to load device info:', error);
        }

        try {
          const { getDeviceCpuTier } =
            await import('../performance/devicePerformanceTier');
          tier = getAnalyticsTier(getDeviceCpuTier());
        } catch (error) {
          // Optional enrichment must never block the analytics request.
          console.warn(
            '[Analytics] Failed to load device performance tier:',
            error,
          );
        }

        return {
          ...deviceInfo,
          tier,
          platform: headerPlatform,
          appBuildNumber: platformEnv.buildNumber,
          appVersion: platformEnv.version,
        };
      })();
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
    eventProps: Record<string, any> | undefined,
    replaySessionId: string | undefined,
  ) {
    if (
      (platformEnv.isDev || platformEnv.isE2E) &&
      !this.enableAnalyticsInDev
    ) {
      return;
    }
    // Transport fields, not event properties: the utility service maps them to
    // PostHog's dedupe uuid and event time, so an event delivered twice (its
    // acknowledgement lost) is counted once. `$`-prefixed names are reserved
    // and must never be used for business properties.
    const {
      $insertId: insertId,
      $timestamp: timestamp,
      ...props
    } = eventProps ?? {};
    const deviceInfo = await this.lazyDeviceInfo();
    const event = {
      ...deviceInfo,
      ...props,
      tier: deviceInfo.tier,
      distinct_id: this.instanceId,
    } as Record<string, unknown>;
    if (replaySessionId) {
      // PostHog's reserved key; the utility service forwards it unchanged.
      event.$session_id = replaySessionId;
    }
    if (
      !platformEnv.isNative &&
      // eslint-disable-next-line unicorn/prefer-global-this
      typeof window !== 'undefined' &&
      // eslint-disable-next-line unicorn/prefer-global-this
      'location' in window
    ) {
      const { href, origin, pathname } = globalThis.location;
      const isWebRedemption =
        platformEnv.isWeb &&
        (pathname === PRIME_REDEEM_LANDING_PATH ||
          pathname === `${PRIME_REDEEM_LANDING_PATH}/`);
      // Emailed redemption links contain a code that must not reach analytics.
      event.currentUrl = isWebRedemption ? `${origin}${pathname}` : href;
    }
    const axios = await this.lazyAxios();
    await axios.post(TRACK_EVENT_PATH, {
      eventName,
      eventProps: event,
      ...(typeof insertId === 'string' && insertId ? { insertId } : {}),
      ...(typeof timestamp === 'number' && Number.isFinite(timestamp)
        ? { timestamp }
        : {}),
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

  whenInitialized(): Promise<void> {
    if (this.instanceId && this.baseURL) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.initializedWaiters.push(resolve);
    });
  }

  public updateUserProfile(attributes: IAnalyticsUserProfile) {
    if (this.instanceId && this.baseURL) {
      void this.requestUserProfile(attributes);
    } else {
      this.cacheUserProfile.push(attributes);
    }
  }

  async updateUserProfileAsync(
    attributes: IAnalyticsUserProfile,
  ): Promise<void> {
    if (!this.instanceId || !this.baseURL) {
      throw new OneKeyLocalError('Analytics is not initialized');
    }
    await this.requestUserProfile(attributes);
  }
}

export const analytics = new Analytics();
appGlobals.$analytics = analytics;
