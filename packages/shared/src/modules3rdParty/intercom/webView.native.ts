import openUrlUtils from '../../utils/openUrlUtils';

import {
  type IShowIntercomParams,
  buildIntercomUrl,
  getCustomerJWT,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';

export const showIntercom = async (params?: IShowIntercomParams) => {
  const token = await getCustomerJWT();
  const instanceId = await getInstanceId();
  const languageOverride = await getIntercomLanguageOverride();

  const supportUrl = 'https://intercom.onekey.so/';

  const url = buildIntercomUrl(supportUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
    conversationId: params?.conversationId,
    languageOverride,
  });

  openUrlUtils.openUrlInApp(url, 'Support');
};
