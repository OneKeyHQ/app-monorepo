import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { toIntercomLanguageOverride } from '@onekeyhq/shared/src/modules3rdParty/intercom/utils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

export async function getCurrentIntercomUserId(): Promise<string | null> {
  await primePersistAtom.ready();
  const user = jotaiDefaultStore.get(primePersistAtom.atom());
  if (!user.isLoggedIn) {
    return null;
  }
  if (!user.onekeyUserId) {
    throw new OneKeyLocalError('Intercom requires a verified OneKey ID');
  }
  return user.onekeyUserId;
}

export async function assertIntercomIdentity(expectedUserId: string | null) {
  // Only identity transitions need an authoritative read. Extension windows
  // can receive the synchronized Prime atom at different times.
  const user =
    await appGlobals.$backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (
    (user.isLoggedIn ? user.onekeyUserId : null) !== expectedUserId ||
    (await getCurrentIntercomUserId()) !== expectedUserId
  )
    throw new OneKeyLocalError('Support session changed');
}

export async function getIntercomCredentials(expectedUserId: string) {
  // Background pins the request to this account's session and rejects the
  // token when that session changed before the response arrived, so the JWT
  // owner does not depend on when this runtime's atom copy synchronizes.
  const response =
    await appGlobals.$backgroundApiProxy.servicePrime.apiGetCustomerJWT({
      expectedOneKeyUserId: expectedUserId,
    });
  if ((await getCurrentIntercomUserId()) !== expectedUserId) {
    return undefined;
  }
  const token = response?.token;
  const claims = token ? stringUtils.decodeJWT(token) : null;
  const userId =
    typeof claims?.user_id === 'string' ? claims.user_id : undefined;
  const email = typeof claims?.email === 'string' ? claims.email : undefined;
  if (!token || !userId) {
    throw new OneKeyLocalError('Intercom identity token is unavailable');
  }
  return {
    token,
    attributes: { userId, ...(email ? { email } : {}) },
  };
}

export const getCurrentLocale = async (): Promise<string | undefined> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for current locale');
      return undefined;
    }

    return await backgroundApiProxy.serviceSetting.getCurrentLocale();
  } catch (error) {
    console.warn('Failed to get current locale for Intercom:', error);
  }

  return undefined;
};

export const getIntercomLanguageOverride = async (): Promise<string> =>
  toIntercomLanguageOverride(await getCurrentLocale());
