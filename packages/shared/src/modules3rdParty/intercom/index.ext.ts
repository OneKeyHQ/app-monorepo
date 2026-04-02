import { buildIntercomUrl, getCustomerJWT, getInstanceId } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async (params?: { requestId?: string }) => {
  const token = await getCustomerJWT();
  const instanceId = await getInstanceId();

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = buildIntercomUrl(baseUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
  });

  window.open(url);
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
