import { openUrlExternal } from '../../utils/openUrlUtils';

import {
  assertIntercomUserUnchanged,
  getCurrentIntercomIdentity,
  getCurrentIntercomUserId,
} from './identity';
import { notifyIntercomOpenFailed } from './openFailure';
import {
  type IIntercomLockPolicy,
  type IShowIntercomParams,
  buildIntercomUrl,
  createIntercomOpenGuard,
  getInstanceId,
} from './utils';

const intercomOpenGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);

export const initIntercom = async () => {
  intercomOpenGuard.setIdentity(await getCurrentIntercomUserId());
  console.log('initIntercom');
};

export const setIntercomTheme = async (_theme: 'light' | 'dark') => {
  // The extension opens the website instead of the native SDK.
};

export const setIntercomMessengerLocked = async (
  _locked: boolean,
  _policy?: IIntercomLockPolicy,
) => {
  // Support opens in a separate browser window outside the wallet lock.
};

export const setIntercomInAppMessageVisibility = async (_visible: boolean) => {
  // The extension does not embed the Messenger in its wallet UI.
};

const openIntercom = async (
  params: IShowIntercomParams | undefined,
  expectedUserId: string | null,
  canPresent: () => boolean,
): Promise<boolean> => {
  const [{ userId, token }, instanceId] = await Promise.all([
    getCurrentIntercomIdentity(),
    getInstanceId(),
  ]);
  if (userId !== expectedUserId) {
    await assertIntercomUserUnchanged(expectedUserId);
    return false;
  }

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = buildIntercomUrl(baseUrl, {
    token,
    instanceId,
    requestId: params?.requestId,
  });

  // The metadata awaits above can outlive the identity check.
  await assertIntercomUserUnchanged(userId);
  if (!canPresent()) {
    return false;
  }
  openUrlExternal(url);
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
