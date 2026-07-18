import resetUtils from '../../utils/resetUtils';

import {
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
  if (intercomInitPromise && !settings) {
    return intercomInitPromise;
  }

  if (resetUtils.getIsResetting()) {
    return;
  }
  const resetGeneration = resetUtils.getResetGeneration();
  let didInitialize = false;

  const initAttempt = (async () => {
    const {
      default: Intercom,
      onShow,
      trackEvent,
      update,
    } = await loadIntercomSdk();
    if (
      resetUtils.getIsResetting() ||
      resetUtils.getResetGeneration() !== resetGeneration
    ) {
      return;
    }

    const APP_ID =
      settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';
    const languageOverride =
      settings?.language_override || (await getIntercomLanguageOverride());
    if (
      resetUtils.getIsResetting() ||
      resetUtils.getResetGeneration() !== resetGeneration
    ) {
      return;
    }

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

    onShow(() => {
      if (resetUtils.getIsResetting()) {
        return;
      }
      const onShowResetGeneration = resetUtils.getResetGeneration();
      const onShowTask = (async () => {
        const instanceIdValue = await getInstanceId();
        resetUtils.checkResetGeneration(onShowResetGeneration);

        trackEvent('client info', {
          instanceId: instanceIdValue,
        });

        const customerJWT = await getCustomerJWT();
        resetUtils.checkResetGeneration(onShowResetGeneration);

        if (customerJWT) {
          update({
            intercom_user_jwt: customerJWT,
          });
        }
      })();
      void resetUtils
        .trackResetSensitiveTask(onShowTask)
        .catch(() => undefined);
    });
    didInitialize = true;
  })();

  const trackedInitAttempt = resetUtils.trackResetSensitiveTask(initAttempt);
  intercomInitPromise = trackedInitAttempt;

  try {
    return await trackedInitAttempt;
  } finally {
    // A reset can deliberately abort initialization before the SDK writes to
    // browser storage. If restart later fails and this runtime is resumed, do
    // not leave a fulfilled no-op promise that permanently disables retries.
    if (!didInitialize && intercomInitPromise === trackedInitAttempt) {
      intercomInitPromise = undefined;
    }
  }
};

export const showIntercom = async (params?: { requestId?: string }) => {
  resetUtils.checkNotInResetting();
  const resetGeneration = resetUtils.getResetGeneration();
  const task = (async () => {
    await initIntercom();
    resetUtils.checkResetGeneration(resetGeneration);
    const {
      show,
      trackEvent,
      update: updateIntercom,
    } = await loadIntercomSdk();
    const instanceIdValue = await getInstanceId();
    const languageOverride = await getIntercomLanguageOverride();
    resetUtils.checkResetGeneration(resetGeneration);

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
  })();
  return resetUtils.trackResetSensitiveTask(task);
};

// Export update for dynamic launcher visibility control
export const update = async (...args: Parameters<IIntercomSdk['update']>) => {
  resetUtils.checkNotInResetting();
  const resetGeneration = resetUtils.getResetGeneration();
  const task = (async () => {
    await initIntercom();
    resetUtils.checkResetGeneration(resetGeneration);
    const sdk = await loadIntercomSdk();
    resetUtils.checkResetGeneration(resetGeneration);
    return sdk.update(...args);
  })();
  return resetUtils.trackResetSensitiveTask(task);
};
