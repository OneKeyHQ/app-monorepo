import appGlobals from '../../appGlobals';
import { OneKeyLocalError } from '../../errors';
import stringUtils from '../../utils/stringUtils';

export async function getCurrentIntercomUserId(): Promise<string | null> {
  const user =
    await appGlobals.$backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!user.isLoggedIn) {
    return null;
  }
  if (!user.onekeyUserId) {
    throw new OneKeyLocalError('Intercom requires a verified OneKey ID');
  }
  return user.onekeyUserId;
}

export async function getIntercomCredentials(expectedUserId: string) {
  const response =
    await appGlobals.$backgroundApiProxy.servicePrime.apiGetCustomerJWT();
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

function throwIntercomUserChanged(): never {
  throw new OneKeyLocalError('Intercom user changed; please try again');
}

export async function assertIntercomUserUnchanged(userId: string | null) {
  if ((await getCurrentIntercomUserId()) !== userId) {
    throwIntercomUserChanged();
  }
}

// Fetched per page load, so a reloaded support page gets a fresh token and a
// session opened for one user can never receive another user's.
export async function getIntercomSessionToken(
  userId: string | null,
): Promise<string | undefined> {
  if (userId === null) {
    await assertIntercomUserUnchanged(userId);
    return undefined;
  }
  const credentials = await getIntercomCredentials(userId);
  if (!credentials) {
    throwIntercomUserChanged();
  }
  return credentials.token;
}
