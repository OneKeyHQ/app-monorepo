import openUrlUtils from '../../utils/openUrlUtils';

import {
  buildIntercomUrl,
  getCustomerJWT,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async (params?: { requestId?: string }) => {
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
};

// Empty update function for native compatibility
// Native doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for native
};
