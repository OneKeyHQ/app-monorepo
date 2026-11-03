import openUrlUtils from '../../utils/openUrlUtils';

import { EIntercomBridge, INTERCOM_SUPPORT_URL } from './bridge';
import {
  assertIntercomUserUnchanged,
  getCurrentIntercomUserId,
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
  const userId = await getCurrentIntercomUserId();
  const [instanceId, languageOverride] = await Promise.all([
    getInstanceId(),
    getIntercomLanguageOverride(),
  ]);

  const url = buildIntercomUrl(INTERCOM_SUPPORT_URL, {
    bridge: EIntercomBridge.Injected,
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
