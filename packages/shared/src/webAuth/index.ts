import { Base64 } from 'js-base64';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const base64Encode = function (arraybuffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(arraybuffer);
  const base64Data = Base64.fromUint8Array(uint8Array);
  return base64Data;
};

export const base64Decode = function (base64: string): ArrayBuffer {
  const uint8Array = Base64.toUint8Array(base64);
  return uint8Array.buffer;
};

const isContextSupportWebAuth = Boolean(
  platformEnv.isExtChrome && globalThis?.navigator?.credentials,
);

const isUserVerifyingPlatformAuthenticatorAvailable = async () => {
  let isAvailable = false;
  if (globalThis?.PublicKeyCredential) {
    isAvailable =
      await globalThis?.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }
  return isAvailable;
};

const isCMA = async () => {
  let isAvailable = false;
  if (globalThis?.PublicKeyCredential) {
    isAvailable =
      await globalThis?.PublicKeyCredential.isConditionalMediationAvailable();
  }
  return isAvailable;
};

export const isSupportWebAuth = async () => {
  let isSupport = false;
  if (!platformEnv.isE2E && isContextSupportWebAuth) {
    isSupport =
      (await isUserVerifyingPlatformAuthenticatorAvailable()) &&
      (await isCMA());
  }
  return isSupport && !!navigator?.credentials;
};

export const verifiedWebAuth = async (credId: string) => {
  if (!(await isSupportWebAuth())) {
    throw new Error('Not support web auth');
  }
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const getCredentialOptions: CredentialRequestOptions = {
    publicKey: {
      allowCredentials: [
        {
          type: 'public-key',
          id: base64Decode(credId),
        },
      ],
      challenge: challenge.buffer,
      timeout: 60_000,
    },
  };
  try {
    return await navigator.credentials.get(getCredentialOptions);
  } catch (e) {
    return undefined;
  }
};

export const registerWebAuth = async (credId?: string) => {
  if (!(await isSupportWebAuth())) {
    throw new Error('Not support web auth');
  }
  if (!navigator?.credentials) {
    throw new Error('navigator.credentials API is not available');
  }
  try {
    if (credId) {
      const cred = await verifiedWebAuth(credId);
      if (cred?.id) {
        return cred.id;
      }
      return undefined;
    }
    const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const createCredentialOptions: CredentialCreationOptions = {
      publicKey: {
        rp: {
          name: 'onekey.so',
        },
        user: {
          id: new Uint8Array(16),
          name: 'OneKey Extension',
          displayName: 'OneKey Extension',
        },
        pubKeyCredParams: [
          {
            'type': 'public-key',
            'alg': -7, // ES256 algorithm
          },
          {
            'type': 'public-key',
            'alg': -257, // RS256 algorithm
          },
        ],
        timeout: 60_000,
        attestation: 'direct',
        challenge: challenge.buffer,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
        },
      },
    };
    const cred = await navigator.credentials.create(createCredentialOptions);
    if (cred) {
      return cred.id;
    }
  } catch (e) {
    return undefined;
  }
};
