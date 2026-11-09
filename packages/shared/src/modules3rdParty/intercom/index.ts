import platformEnv from '../../platformEnv';
import openUrlUtils from '../../utils/openUrlUtils';

import {
  buildIntercomUrl,
  getCustomerJWT,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';

import type { InitType } from '@intercom/messenger-js-sdk/dist/types';

type IIntercomSdk = typeof import('@intercom/messenger-js-sdk');

let intercomSdkPromise: Promise<IIntercomSdk> | undefined;
let intercomInitPromise: Promise<void> | undefined;

const loadIntercomSdk = () => {
  intercomSdkPromise ||= import('@intercom/messenger-js-sdk');
  return intercomSdkPromise;
};

const clearIntercomOpenOnBoot = (appId: string) => {
  try {
    const key = `intercom.intercom-state-${appId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const state = JSON.parse(raw);
      if (state.openOnBoot?.metadata?.articleIds?.length) {
        delete state.openOnBoot;
        localStorage.setItem(key, JSON.stringify(state));
      }
    }
  } catch {
    // ignore
  }
};

export const initIntercom = async (settings?: Partial<InitType>) => {
  // Desktop opens Intercom in an in-app webview instead of injecting the SDK
  if (platformEnv.isDesktop) {
    return;
  }

  if (intercomInitPromise && !settings) {
    return intercomInitPromise;
  }

  intercomInitPromise = (async () => {
    const {
      default: Intercom,
      onShow,
      trackEvent,
      update,
    } = await loadIntercomSdk();

    const APP_ID =
      settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';
    const languageOverride =
      settings?.language_override || (await getIntercomLanguageOverride());

    // Clear previous session's openOnBoot state to prevent auto-opening messenger on cold start
    clearIntercomOpenOnBoot(APP_ID);

    Intercom({
      app_id: APP_ID,
      hide_default_launcher: true,
      alignment: 'right',
      horizontal_padding: 10,
      vertical_padding: 55,
      ...(languageOverride ? { language_override: languageOverride } : {}),
      ...settings,
    });

    onShow(async () => {
      const instanceIdValue = await getInstanceId();

      trackEvent('client info', {
        instanceId: instanceIdValue,
      });

      const customerJWT = await getCustomerJWT();

      if (customerJWT) {
        update({
          intercom_user_jwt: customerJWT,
        });
      }
    });
  })();

  return intercomInitPromise;
};

export const showIntercom = async (params?: { requestId?: string }) => {
  if (platformEnv.isDesktop) {
    const token = await getCustomerJWT();
    const instanceId = await getInstanceId();
    const languageOverride = await getIntercomLanguageOverride();
    const supportUrl = 'https://intercom.onekey.so/';
    const url = buildIntercomUrl(supportUrl, {
      token,
      instanceId,
      requestId: params?.requestId,
      languageOverride,
    });
    openUrlUtils.openUrlInApp(url, 'Support');
    return;
  }

  await initIntercom();
  const { show, trackEvent, update: updateIntercom } = await loadIntercomSdk();
  const instanceIdValue = await getInstanceId();
  const languageOverride = await getIntercomLanguageOverride();

  trackEvent('client info', {
    instanceId: instanceIdValue,
    requestId: params?.requestId,
  });

  if (languageOverride) {
    updateIntercom({
      language_override: languageOverride,
    });
  }

  show();
};

// Export update for dynamic launcher visibility control
export const update = async (...args: Parameters<IIntercomSdk['update']>) => {
  // Desktop never loads the Intercom SDK: launcher visibility is controlled by
  // the in-app webview page instead.
  if (platformEnv.isDesktop) {
    return;
  }
  await initIntercom();
  const sdk = await loadIntercomSdk();
  return sdk.update(...args);
};
