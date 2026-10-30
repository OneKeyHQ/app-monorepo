import openUrlUtils from '../../utils/openUrlUtils';

import {
  assertIntercomUserUnchanged,
  getCurrentIntercomIdentity,
} from './identity';
import {
  type IShowIntercomParams,
  buildIntercomUrl,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';

export const showIntercom = async (params?: IShowIntercomParams) => {
  const { userId, token } = await getCurrentIntercomIdentity();
  const [instanceId, languageOverride] = await Promise.all([
    getInstanceId(),
    getIntercomLanguageOverride(),
  ]);

  const supportUrl = 'https://intercom.onekey.so/';

  const url = buildIntercomUrl(supportUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
    conversationId: params?.conversationId,
    languageOverride,
  });

  // The metadata awaits above can outlive the identity check.
  await assertIntercomUserUnchanged(userId);
  openUrlUtils.openUrlInApp(url, 'Support');
};
