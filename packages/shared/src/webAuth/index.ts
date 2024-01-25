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
  platformEnv.isExtChrome && global?.navigator?.credentials,
);

const isUserVerifyingPlatformAuthenticatorAvailable = async () => {
  let isAvailable = false;
  if (global?.PublicKeyCredential) {
    isAvailable =
      await global?.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }
  return isAvailable;
};

export const isSupportWebAuth = async () => {
  let isSupport = false;
  if (isContextSupportWebAuth) {
    isSupport = await isUserVerifyingPlatformAuthenticatorAvailable();
  }
  return isSupport;
};

export const registerWebAuth = async () => {
  if (!(await isSupportWebAuth())) {
    throw new Error('Not support web auth');
  }
  const challenge = global.crypto.getRandomValues(new Uint8Array(32));
  const createCredentialOptions: CredentialCreationOptions = {
    publicKey: {
      rp: {
        name: 'OneKey',
      },
      user: {
        id: new Uint8Array(16),
        name: 'OneKey',
        displayName: 'OneKey Wallet',
      },
      pubKeyCredParams: [
        {
          'type': 'public-key',
          'alg': -7,
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

  const cred = await navigator.credentials.create(createCredentialOptions);
  if (cred) {
    return cred.id;
  }
};

export const verifiedWebAuth = async (credId: string) => {
  if (!(await isSupportWebAuth())) {
    throw new Error('Not support web auth');
  }
  const challenge = global.crypto.getRandomValues(new Uint8Array(32));
  const getCredentialOptions: CredentialRequestOptions = {
    publicKey: {
      allowCredentials: [
        {
          type: 'public-key',
          id: base64Decode(credId),
        },
      ],
      challenge: challenge.buffer,
      timeout: 60000,
    },
  };
  return navigator.credentials.get(getCredentialOptions);
};
