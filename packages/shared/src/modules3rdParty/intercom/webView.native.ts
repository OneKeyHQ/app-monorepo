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

export const showIntercom = async (
  params?: IShowIntercomParams,
  canPresent: (userId: string | null) => boolean = () => true,
): Promise<boolean> => {
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
    languageOverride,
  });

  // The metadata awaits above can outlive the identity check.
  await assertIntercomUserUnchanged(userId);
  if (!canPresent(userId)) {
    return false;
  }
  openUrlUtils.openUrlInApp(url, 'Support', {
    hideHeaderRight: true,
    redirectExternalNavigation: true,
    disableBridge: true,
    intercomUserId: userId,
  });
  return true;
};
