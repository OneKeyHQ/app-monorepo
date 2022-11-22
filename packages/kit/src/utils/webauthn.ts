/* eslint-disable no-plusplus, no-bitwise, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call  */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { setEnableWebAuthn } from '../store/reducers/settings';

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Use a lookup table to find the index.
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export const encode = function (arraybuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arraybuffer);
  const len = bytes.length;
  let base64 = '';

  for (let i = 0; i < len; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    base64 += chars[bytes[i + 2] & 63];
  }

  if (len % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1);
  } else if (len % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2);
  }

  return base64;
};

export const decode = function (base64: string): ArrayBuffer {
  const len = base64.length;
  const bufferLength = base64.length * 0.75;
  const arraybuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arraybuffer);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
};

const replyPartyName = 'onekey.so';

export const isSupportedPlatform = platformEnv.isExtChrome;

export const isMac = () => navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const isContextSupportWebAuthn = Boolean(
  isSupportedPlatform && global?.navigator?.credentials,
);

export const isUserVerifyingPlatformAuthenticatorAvailable = async () => {
  let result = false;
  try {
    result =
      await global.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.();
  } catch {
    console.log('isUserVerifyingPlatformAuthenticatorAvailable failure');
  }
  return result;
};

type RegisterCredentialParams = {
  userName: string;
  userDisplayName: string;
};

const registerCredential = async (params: RegisterCredentialParams) => {
  if (!isSupportedPlatform) {
    throw new Error('Web Auth only supports web platforms');
  }
  if (!navigator.credentials) {
    throw new Error('navigator.credentials API is not available');
  }
  let challenge = global.crypto.getRandomValues(new Uint8Array(32));
  const credentialID =
    await backgroundApiProxy.serviceSetting.getWebAuthnCredentialID();
  if (credentialID) {
    const cred = await navigator.credentials.get({
      publicKey: {
        timeout: 60000,
        challenge: challenge.buffer,
        allowCredentials: [
          {
            type: 'public-key' as const,
            id: decode(credentialID),
          },
        ],
      },
    });
    if (cred && cred.id === credentialID) {
      return cred;
    }
  }
  challenge = global.crypto.getRandomValues(new Uint8Array(32));
  const createCredentialDefaultArgs: CredentialCreationOptions = {
    publicKey: {
      rp: {
        name: replyPartyName,
      },
      user: {
        id: new Uint8Array(16),
        name: params.userName,
        displayName: params.userDisplayName,
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7,
        },
      ],
      timeout: 60000,
      attestation: 'direct',
      challenge: challenge.buffer,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
      },
    },
  };

  const cred = await navigator.credentials.create(createCredentialDefaultArgs);
  if (cred) {
    await backgroundApiProxy.serviceSetting.setWebAuthnCredentialID(cred.id);
  }
  return cred;
};

const getCredential = async () => {
  if (!isSupportedPlatform) {
    throw new Error('Web Auth only supports web platforms');
  }
  if (!navigator.credentials) {
    throw new Error('navigator.credentials API is not available');
  }
  const credentialID =
    await backgroundApiProxy.serviceSetting.getWebAuthnCredentialID();
  if (!credentialID) {
    return null;
  }
  const challenge = global.crypto.getRandomValues(new Uint8Array(32));
  const getCredentialDefaultArgs = {
    publicKey: {
      timeout: 60000,
      challenge: challenge.buffer,
      allowCredentials: [
        {
          type: 'public-key' as const,
          id: decode(credentialID),
        },
      ],
    },
  };
  const credential = await navigator.credentials.get(getCredentialDefaultArgs);
  return credential;
};

export const enableWebAuthn = async () => {
  const cred = await getCredential();
  if (!cred) {
    const instanceId = await backgroundApiProxy.serviceSetting.getInstanceId();
    await registerCredential({
      userName: instanceId,
      userDisplayName: instanceId,
    });
    backgroundApiProxy.dispatch(setEnableWebAuthn(true));
  }
  backgroundApiProxy.dispatch(setEnableWebAuthn(true));
};

export const disableWebAuthn = () => {
  backgroundApiProxy.dispatch(setEnableWebAuthn(false));
};

export const webAuthenticate = async (): Promise<boolean> => {
  const cred = await getCredential();
  return !!cred;
};
