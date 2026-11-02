import openUrlUtils from '../../utils/openUrlUtils';

import { EIntercomBridge, INTERCOM_SUPPORT_URL } from './bridge';
import {
  assertIntercomUserUnchanged,
  getCurrentIntercomUserId,
} from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  buildIntercomUrl,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const setIntercomTheme = async (_theme: 'light' | 'dark') => {
  // The extension embeds the hosted page instead of the native SDK.
};

export const setIntercomMessengerLocked = async (
  _locked: boolean,
  _policy?: IIntercomLockPolicy,
) => {
  // WebViewModal unmounts the embedded support page when the wallet locks.
};

export const setIntercomInAppMessageVisibility = async (_visible: boolean) => {
  // The extension does not embed the Messenger in its wallet UI.
};

const openIntercom = async (params?: IShowIntercomParams) => {
  const userId = await getCurrentIntercomUserId();
  const [instanceId, languageOverride] = await Promise.all([
    getInstanceId(),
    getIntercomLanguageOverride(),
  ]);

  const url = buildIntercomUrl(INTERCOM_SUPPORT_URL, {
    bridge: EIntercomBridge.MessageChannel,
    parentOrigin: globalThis.location.origin,
    instanceId,
    requestId: params?.requestId,
    languageOverride,
  });

  // The metadata awaits above can outlive the identity check.
  await assertIntercomUserUnchanged(userId);
  openUrlUtils.openUrlInApp(url, 'Support', {
    hideHeaderRight: true,
    disableBridge: true,
    intercomUserId: userId,
  });
};

export const showIntercom = async (params?: IShowIntercomParams) => {
  try {
    await openIntercom(params);
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
