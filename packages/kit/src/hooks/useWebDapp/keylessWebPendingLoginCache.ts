import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  type IKeylessPendingLogin,
  type IKeylessPendingLoginStatus,
  KEYLESS_PENDING_LOGIN_EXPIRE_MS,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';

let pendingLoginCache: IKeylessPendingLogin | undefined;

function isExpiredPendingLogin(pendingLogin?: IKeylessPendingLogin) {
  if (!pendingLogin) {
    return true;
  }
  return pendingLogin.expireAt <= Date.now();
}

function readKeylessPendingLogin(): IKeylessPendingLogin | undefined {
  if (isExpiredPendingLogin(pendingLoginCache)) {
    pendingLoginCache = undefined;
    return undefined;
  }
  return pendingLoginCache;
}

function writeKeylessPendingLogin(pendingLogin: IKeylessPendingLogin) {
  pendingLoginCache = pendingLogin;
}

function createKeylessPendingLogin(params: {
  provider: EOAuthSocialLoginProvider;
  nonce: string;
  expireInMs?: number;
}): IKeylessPendingLogin {
  const createdAt = Date.now();
  const pendingLogin: IKeylessPendingLogin = {
    provider: params.provider,
    nonce: params.nonce,
    createdAt,
    expireAt:
      createdAt + (params.expireInMs ?? KEYLESS_PENDING_LOGIN_EXPIRE_MS),
    status: 'pending',
  };
  writeKeylessPendingLogin(pendingLogin);
  return pendingLogin;
}

function updateKeylessPendingLoginStatus(
  status: IKeylessPendingLoginStatus,
  options?: { nonce?: string },
): IKeylessPendingLogin | undefined {
  const pendingLogin = readKeylessPendingLogin();
  if (!pendingLogin) {
    return undefined;
  }
  if (options?.nonce && pendingLogin.nonce !== options.nonce) {
    return pendingLogin;
  }
  const updatedPendingLogin: IKeylessPendingLogin = {
    ...pendingLogin,
    status,
  };
  writeKeylessPendingLogin(updatedPendingLogin);
  return updatedPendingLogin;
}

function consumeKeylessPendingLogin(options?: { nonce?: string }) {
  return updateKeylessPendingLoginStatus('consumed', options);
}

function clearKeylessPendingLogin(options?: { nonce?: string }) {
  const pendingLogin = readKeylessPendingLogin();
  if (options?.nonce && pendingLogin?.nonce !== options.nonce) {
    return;
  }
  pendingLoginCache = undefined;
}

const keylessWebPendingLoginCache = {
  readKeylessPendingLogin,
  writeKeylessPendingLogin,
  createKeylessPendingLogin,
  updateKeylessPendingLoginStatus,
  consumeKeylessPendingLogin,
  clearKeylessPendingLogin,
};

export default keylessWebPendingLoginCache;
