import { defaultLogger } from '../../logger/logger';
import openUrlUtils from '../../utils/openUrlUtils';

import { EIntercomBridge } from './bridge';
import {
  assertIntercomUserUnchanged,
  getCurrentIntercomUserId,
} from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  buildIntercomUrl,
  createIntercomOpenGuard,
  getInstanceId,
  getIntercomLanguageOverride,
  getIntercomSupportUrl,
} from './utils';

const intercomOpenGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);

export const initIntercom = async () => {
  intercomOpenGuard.setIdentity(await getCurrentIntercomUserId());
  console.log('initIntercom');
};

export const setIntercomTheme = async (
  _theme: 'light' | 'dark',
  _followSystem?: boolean,
) => {
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

const openIntercom = async (
  params: IShowIntercomParams | undefined,
  expectedUserId: string | null,
  canPresent: () => boolean,
): Promise<boolean> => {
  const [userId, instanceId, languageOverride, supportUrl] = await Promise.all([
    getCurrentIntercomUserId(),
    getInstanceId(),
    getIntercomLanguageOverride(),
    getIntercomSupportUrl(),
  ]);
  if (userId !== expectedUserId) {
    await assertIntercomUserUnchanged(expectedUserId);
    return false;
  }

  const url = buildIntercomUrl(supportUrl, {
    bridge: EIntercomBridge.MessageChannel,
    parentOrigin: globalThis.location.origin,
    instanceId,
    requestId: params?.requestId,
    languageOverride,
  });

  // The metadata awaits above can outlive the identity check.
  await assertIntercomUserUnchanged(userId);
  if (!canPresent()) {
    return false;
  }
  defaultLogger.notification.support.supportReplyBranch({
    conversationId: params?.conversationId,
    selectedBranch: 'extension-webview',
  });
  openUrlUtils.openUrlInApp(url, 'Support', {
    hideHeaderRight: true,
    disableBridge: true,
    intercomUserId: userId,
  });
  return true;
};

export const showIntercom = async (params?: IShowIntercomParams) => {
  try {
    const userId = await getCurrentIntercomUserId();
    await intercomOpenGuard.run(userId, params, (canPresent) =>
      openIntercom(params, userId, canPresent),
    );
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
