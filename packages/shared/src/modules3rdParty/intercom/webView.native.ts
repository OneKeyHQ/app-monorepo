import { defaultLogger } from '../../logger/logger';
import openUrlUtils from '../../utils/openUrlUtils';

import { EIntercomBridge } from './bridge';
import {
  assertIntercomUserUnchanged,
  getCurrentIntercomUserId,
} from './identity';
import {
  type IShowIntercomParams,
  buildIntercomUrl,
  getInstanceId,
  getIntercomLanguageOverride,
  getIntercomSupportUrl,
} from './utils';

export const showIntercom = async (
  params?: IShowIntercomParams,
  canPresent: (userId: string | null) => boolean = () => true,
): Promise<boolean> => {
  const userId = await getCurrentIntercomUserId();
  const [instanceId, languageOverride, supportUrl] = await Promise.all([
    getInstanceId(),
    getIntercomLanguageOverride(),
    getIntercomSupportUrl(),
  ]);

  const url = buildIntercomUrl(supportUrl, {
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
  defaultLogger.notification.support.supportReplyBranch({
    conversationId: params?.conversationId,
    selectedBranch: 'native-webview-fallback',
  });
  openUrlUtils.openUrlInApp(url, 'Support', {
    hideHeaderRight: true,
    redirectExternalNavigation: true,
    disableBridge: true,
    intercomUserId: userId,
  });
  return true;
};
