import {
  type IShowIntercomParams,
  buildIntercomUrl,
  getCustomerJWT,
  getInstanceId,
} from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const setIntercomTheme = async (_theme: 'light' | 'dark') => {
  // The extension opens the website instead of the native SDK.
};

export const setIntercomInAppMessageVisibility = async (_visible: boolean) => {
  // The extension does not embed the Messenger in its wallet UI.
};

export const showIntercom = async (params?: IShowIntercomParams) => {
  const token = await getCustomerJWT();
  const instanceId = await getInstanceId();

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = buildIntercomUrl(baseUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
    conversationId: params?.conversationId,
  });

  window.open(url);
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
