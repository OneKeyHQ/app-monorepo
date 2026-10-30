import { getCurrentIntercomToken } from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IShowIntercomParams,
  buildIntercomUrl,
  getInstanceId,
} from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const setIntercomTheme = async (_theme: 'light' | 'dark') => {
  // The extension opens the website instead of the native SDK.
};

export const setIntercomMessengerLocked = async (_locked: boolean) => {
  // Support opens in a separate browser window outside the wallet lock.
};

export const setIntercomInAppMessageVisibility = async (_visible: boolean) => {
  // The extension does not embed the Messenger in its wallet UI.
};

const openIntercom = async (params?: IShowIntercomParams) => {
  const [token, instanceId] = await Promise.all([
    getCurrentIntercomToken(),
    getInstanceId(),
  ]);

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = buildIntercomUrl(baseUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
    conversationId: params?.conversationId,
  });

  window.open(url);
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
