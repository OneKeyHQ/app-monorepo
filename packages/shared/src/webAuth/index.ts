/* eslint-disable no-plusplus, no-bitwise */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Use a lookup table to find the index.
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

// export const encode = function (arraybuffer: ArrayBuffer): string {
//   const bytes = new Uint8Array(arraybuffer);
//   const len = bytes.length;
//   let base64 = '';

//   for (let i = 0; i < len; i += 3) {
//     base64 += chars[bytes[i] >> 2];
//     base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
//     base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
//     base64 += chars[bytes[i + 2] & 63];
//   }

//   if (len % 3 === 2) {
//     base64 = base64.substring(0, base64.length - 1);
//   } else if (len % 3 === 1) {
//     base64 = base64.substring(0, base64.length - 2);
//   }

//   return base64;
// };

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
        displayName: 'OneKey',
      },
      // eslint-disable-next-line spellcheck/spell-checker
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      attestation: 'direct',
      challenge: challenge.buffer,
      authenticatorSelection: {
        userVerification: 'required',
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
          id: decode(credId),
        },
      ],
      challenge: challenge.buffer,
      timeout: 60000,
    },
  };
  return navigator.credentials.get(getCredentialOptions);
};
