import { Base64 } from 'js-base64';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

// Diagnostic sink for the lock-screen log-upload gate. Mirrors to console
// UNCONDITIONALLY (the defaultLogger local transport only console-logs in dev,
// and its background bridge may be unavailable on the lock screen when the
// keychain is broken — exactly the case we are debugging) AND to defaultLogger
// so it can also be exported when the bridge is up.
function diagLog(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg);
  const { webAuth } = defaultLogger.app;
  webAuth.log(msg);
}

export const base64Encode = function (arraybuffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(arraybuffer);
  const base64Data = Base64.fromUint8Array(uint8Array);
  return base64Data;
};

export const base64Decode = function (base64: string): Uint8Array {
  return Base64.toUint8Array(base64);
};

const isContextSupportWebAuth = Boolean(
  platformEnv.isExtension && globalThis?.navigator?.credentials,
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
    const isUvPaaAvailable =
      await isUserVerifyingPlatformAuthenticatorAvailable();
    const isConditionalMediationAvailable = await isCMA();
    isSupport = isUvPaaAvailable && isConditionalMediationAvailable;
  }

  const finalSupport = isSupport && !!navigator?.credentials;

  return finalSupport;
};

export const verifiedWebAuth = async (
  credId: string,
  options?: {
    // Restrict verification to the built-in platform authenticator (Touch ID /
    // Windows Hello on THIS device) and reject the cross-device "use a passkey
    // on another device" (hybrid/caBLE) and roaming USB-key flows.
    platformAuthenticatorOnly?: boolean;
  },
) => {
  if (!(await isSupportWebAuth())) {
    throw new OneKeyLocalError('Not support web auth');
  }
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const getCredentialOptions: CredentialRequestOptions = {
    mediation: 'required',
    publicKey: {
      allowCredentials: [
        {
          type: 'public-key',
          id: base64Decode(credId) as BufferSource,
          // Hint the client that the credential lives on the internal
          // authenticator so the hybrid/USB transports are not offered.
          ...(options?.platformAuthenticatorOnly
            ? { transports: ['internal'] as AuthenticatorTransport[] }
            : null),
        },
      ],
      userVerification: 'required',
      challenge: challenge.buffer,
      timeout: 60_000,
    },
  };
  try {
    const cred = await navigator.credentials.get(getCredentialOptions);
    if (options?.platformAuthenticatorOnly) {
      const attachment = (
        cred as { authenticatorAttachment?: string | null } | null
      )?.authenticatorAttachment;
      // Only reject when the client explicitly reports a non-platform
      // authenticator; when it is unreported we rely on the `internal`
      // transport hint above.
      if (attachment && attachment !== 'platform') {
        return undefined;
      }
    }
    return cred;
  } catch (e) {
    // Capture the RAW WebAuthn error before it is collapsed into
    // cancelError/undefined, so a lost/corrupted platform credential can be
    // told apart from a genuine user cancel (see AppStateLock log-upload gate).
    const rawErr = e as { name?: string; message?: string; code?: number };
    diagLog(
      `[KeychainLogUploadDiag] verifiedWebAuth raw error ${JSON.stringify({
        name: rawErr?.name,
        message: rawErr?.message,
        code: rawErr?.code,
        ctor: (e as { constructor?: { name?: string } })?.constructor?.name,
        isDOMException: e instanceof DOMException,
        str: String(e),
      })}`,
    );
    if (
      e instanceof DOMException &&
      (e.name === 'NotAllowedError' || e.name === 'AbortError')
    ) {
      diagLog('[KeychainLogUploadDiag] verifiedWebAuth -> throw cancelError');
      const cancelError = new Error('');
      cancelError.name = BIOLOGY_AUTH_CANCEL_ERROR;
      throw cancelError;
    }
    diagLog(
      '[KeychainLogUploadDiag] verifiedWebAuth -> return undefined (non-cancel error)',
    );
    return undefined;
  }
};

export const registerWebAuth = async (credId?: string) => {
  if (!(await isSupportWebAuth())) {
    throw new OneKeyLocalError('Not support web auth');
  }
  if (!navigator?.credentials) {
    throw new OneKeyLocalError('navigator.credentials API is not available');
  }
  if (credId) {
    // Reuse-if-valid: verify the existing credential first. On success we
    // return its id and NEVER create a new one (so repeated enable toggles do
    // not pile up credentials). A NotAllowedError here is ambiguous (user
    // cancel vs. lost credential) and surfaces as BIOLOGY_AUTH_CANCEL_ERROR.
    // This block is kept OUTSIDE the create try/catch below so that
    // cancelError PROPAGATES to the caller (setWebAuthEnable) — which can then
    // ask the user whether to register a fresh credential — rather than being
    // swallowed to undefined.
    const cred = await verifiedWebAuth(credId);
    if (cred?.id) {
      return cred.id;
    }
    return undefined;
  }
  try {
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
        challenge: challenge.buffer,
        authenticatorSelection: {
          requireResidentKey: true,
          userVerification: 'required',
        },
      },
    };
    const cred = await navigator.credentials.create(createCredentialOptions);
    if (cred) {
      return cred.id;
    }
  } catch (_e) {
    return undefined;
  }
};
