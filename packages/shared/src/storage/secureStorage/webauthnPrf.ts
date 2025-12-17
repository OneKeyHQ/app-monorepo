/* eslint-disable @typescript-eslint/no-unused-vars, spellcheck/spell-checker */
import { Buffer } from 'buffer';

import platformEnv from '../../platformEnv';

// Storage keys
const PRF_CREDENTIAL_ID_KEY = '$secure_prf_credential_id$';
const PRF_SALT_KEY = '$secure_prf_salt$';

// Salt length for PRF evaluation (32 bytes = 256 bits)
const PRF_SALT_LENGTH = 32;

const ALLOW_EXTERNAL_AUTHENTICATORS = false;

/**
 * Generate a random salt for PRF evaluation
 */
function generatePrfSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(PRF_SALT_LENGTH));
}

/**
 * Convert Uint8Array to base64 string for storage
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64');
}

/**
 * Convert base64 string back to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

// Authenticator transport types for user hints
export type IAuthenticatorTransport =
  | 'internal'
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'hybrid';

export interface IPrfCredential {
  credentialId: string;
  rawId: Uint8Array;
  // Transport types supported by this credential (for user hints)
  transports?: IAuthenticatorTransport[];
  // Random salt generated during registration (base64 encoded for storage)
  salt: string;
  // PRF-derived key (available after registration, so caller doesn't need a second auth)
  prfKey: Uint8Array;
}

// Human-readable descriptions for transport types
export const TRANSPORT_DESCRIPTIONS: Record<IAuthenticatorTransport, string> = {
  internal: 'Touch ID / Face ID / Windows Hello',
  usb: 'USB Security Key',
  nfc: 'NFC Security Key',
  ble: 'Bluetooth Security Key',
  hybrid: 'Phone / Other Device',
};

/**
 * Get human-readable description for authenticator transports
 */
export function getTransportDescription(
  transports?: IAuthenticatorTransport[],
): string {
  if (!transports || transports.length === 0) {
    return 'Unknown Device';
  }
  // Return the first transport's description (primary transport)
  return TRANSPORT_DESCRIPTIONS[transports[0]] || 'Security Key';
}

export interface IPrfAuthResult {
  prfKey: Uint8Array;
  credentialId: string;
}

// Helper: Convert base64url to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  // Replace URL-safe characters
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Cache for PRF support check result
let prfSupportedCache: boolean | undefined;
let prfSupportedPromise: Promise<boolean> | undefined;

/**
 * Check if internal authenticator (Touch ID, Face ID, Windows Hello) is available
 * This is the raw check without caching
 */
export async function isInternalAuthenticatorAvailable(): Promise<boolean> {
  if (!globalThis?.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Check if WebAuthn PRF extension is supported (cached)
 * Note: PRF can work with both internal authenticators (Touch ID, Face ID, Windows Hello)
 * and external authenticators (YubiKey 5 series with hmac-secret support)
 */
export async function isPrfSupported(): Promise<boolean> {
  // Return cached result if available
  if (prfSupportedCache !== undefined) {
    return prfSupportedCache;
  }

  // Return pending promise if check is in progress
  if (prfSupportedPromise) {
    return prfSupportedPromise;
  }

  // Start the check and cache the promise
  prfSupportedPromise = (async () => {
    if (!globalThis?.PublicKeyCredential) {
      prfSupportedCache = false;
      return false;
    }

    // Check if WebAuthn is available
    // Note: We don't require internal authenticator anymore since external USB keys
    // (like YubiKey 5 with firmware 5.4+) can also support PRF via hmac-secret extension
    if (!navigator?.credentials) {
      prfSupportedCache = false;
      return false;
    }

    // Check if PRF extension is likely supported (Chrome 116+)
    // Note: There's no direct way to check PRF support before creating a credential
    // The actual PRF support depends on the authenticator used
    prfSupportedCache = true;
    return prfSupportedCache;
  })();

  return prfSupportedPromise;
}

/**
 * Register a new credential with PRF extension
 * PRF is evaluated during registration, so prfKey is returned directly (single biometric prompt)
 */
export async function registerPrfCredential(): Promise<
  IPrfCredential | undefined
> {
  if (!(await isPrfSupported())) {
    return undefined;
  }

  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const userId = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // Generate random salt before creating credential
  // This salt will be used for PRF evaluation during registration
  const salt = generatePrfSalt();

  const createOptions: CredentialCreationOptions = {
    publicKey: {
      rp: {
        name: 'OneKey Wallet',
        // for Desktop localhost?
        // id: globalThis.location?.hostname || 'onekey.so',
      },
      user: {
        id: userId,
        name: 'OneKey',
        displayName: 'OneKey',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: 60_000,
      challenge,
      authenticatorSelection: {
        // authenticatorAttachment: Restricts the type of authenticator allowed
        // - 'platform': Internal authenticators only (Touch ID, Face ID, Windows Hello)
        // - 'cross-platform': External authenticators only (USB keys, NFC, BLE)
        // - undefined: Allow all types (both internal and external)
        // Controlled by ALLOW_EXTERNAL_AUTHENTICATORS flag
        authenticatorAttachment: ALLOW_EXTERNAL_AUTHENTICATORS
          ? undefined
          : 'platform',
        // userVerification: Controls whether biometric/PIN verification is required
        // - 'required': Must verify user (biometric or PIN)
        // - 'preferred': Verify if possible, but not required
        // - 'discouraged': Skip verification if possible
        userVerification: 'required',
        // requireResidentKey: true,
        // residentKey: 'required',
      },
      extensions: {
        // Evaluate PRF during registration to get prfKey in single biometric prompt
        prf: {
          eval: {
            first: salt as BufferSource,
          },
        },
      },
    },
  };

  try {
    const credential = (await navigator.credentials.create(
      createOptions,
    )) as PublicKeyCredential | null;

    if (!credential) {
      return undefined;
    }

    // Get PRF result from extension results
    const extensionResults = credential.getClientExtensionResults() as {
      prf?: {
        enabled?: boolean;
        results?: { first?: ArrayBuffer };
      };
    };

    // Check if PRF extension returned the key
    const prfOutput = extensionResults?.prf?.results?.first;
    if (!prfOutput) {
      console.error(
        'PRF output not available during registration. ' +
          'The authenticator may not support PRF evaluation during create.',
      );
      return undefined;
    }

    // Get transport types from the response (for user hints during authentication)
    const response = credential.response as AuthenticatorAttestationResponse;
    let transports: IAuthenticatorTransport[] | undefined;
    if (response.getTransports) {
      transports = response.getTransports() as IAuthenticatorTransport[];
    }

    const saltBase64 = uint8ArrayToBase64(salt);

    return {
      credentialId: credential.id,
      rawId: new Uint8Array(credential.rawId),
      transports,
      salt: saltBase64,
      prfKey: new Uint8Array(prfOutput),
    };
  } catch (error) {
    console.error('Failed to register PRF credential:', error);
    return undefined;
  }
}

/**
 * Authenticate with PRF extension to derive encryption key
 * @param options.credentialId - Optional. If provided, only this credential can be used.
 *                               If omitted, user can select from all available passkeys (discoverable mode).
 * @param options.salt - Required. The salt (base64 encoded) that was generated during registration.
 *                       Must be the same salt to derive the same encryption key.
 */
export async function authenticateWithPrf(options: {
  credentialId?: string;
  salt: string;
}): Promise<IPrfAuthResult | undefined> {
  const { credentialId, salt } = options;

  if (!(await isPrfSupported())) {
    return undefined;
  }

  // Convert base64 salt back to Uint8Array
  const saltBytes = base64ToUint8Array(salt);

  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));

  const getOptions: CredentialRequestOptions = {
    // mediation: Controls user interaction behavior
    // - 'required': Always show UI for user confirmation (recommended for sensitive ops)
    // - 'optional': Silent if single match, otherwise show UI (default)
    // - 'silent': No UI, fail silently if user action needed
    // - 'conditional': For autofill UI in input fields
    mediation: 'required',
    publicKey: {
      // If credentialId is provided, restrict to that credential
      // If not, allow user to select from all available passkeys (discoverable)
      allowCredentials: credentialId
        ? [
            {
              type: 'public-key',
              id: base64UrlToArrayBuffer(credentialId),
              // transports: Hints for how to communicate with the authenticator
              // - 'internal': Internal authenticators (Touch ID, Face ID, Windows Hello)
              // - 'usb': External USB security keys (YubiKey, etc.)
              // - 'nfc': External NFC security keys
              // - 'ble': External Bluetooth security keys
              // - 'hybrid': Cross-device authentication (phone as authenticator)
              // Note: This is a hint, browser may ignore it
              // Controlled by ALLOW_EXTERNAL_AUTHENTICATORS flag
              transports: ALLOW_EXTERNAL_AUTHENTICATORS
                ? ['internal', 'usb', 'nfc', 'ble', 'hybrid']
                : ['internal'],
            },
          ]
        : [],
      // userVerification: Controls biometric/PIN verification
      // - 'required': Must verify user
      // - 'preferred': Verify if possible
      // - 'discouraged': Skip if possible
      userVerification: 'required',
      challenge,
      timeout: 60_000,
      extensions: {
        prf: {
          eval: {
            // Use the stored salt for consistent key derivation
            first: saltBytes as BufferSource,
          },
        },
      },
    },
  };

  try {
    const assertion = (await navigator.credentials.get(
      getOptions,
    )) as PublicKeyCredential | null;

    if (!assertion) {
      return undefined;
    }

    const extensionResults = assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    };

    const prfOutput = extensionResults?.prf?.results?.first;
    if (!prfOutput) {
      console.error('PRF output not available');
      return undefined;
    }

    return {
      prfKey: new Uint8Array(prfOutput),
      credentialId: assertion.id,
    };
  } catch (error) {
    console.error('Failed to authenticate with PRF:', error);
    return undefined;
  }
}

export interface IPrfDiscoverableResult extends IPrfAuthResult {
  // The newly generated salt for this credential (base64 encoded)
  salt: string;
}

/**
 * Authenticate with PRF in discoverable mode (allow user to select any passkey)
 * This is useful for first-time setup when no credential is stored.
 * A new salt will be generated for the selected credential.
 */
export async function authenticateWithPrfDiscoverable(): Promise<
  IPrfDiscoverableResult | undefined
> {
  // Generate a new salt for the selected credential
  const newSalt = uint8ArrayToBase64(generatePrfSalt());

  const result = await authenticateWithPrf({ salt: newSalt });
  if (!result) {
    return undefined;
  }

  return {
    ...result,
    salt: newSalt,
  };
}

/**
 * Encrypt data using AES-GCM with PRF-derived key
 */
export async function encryptWithPrfKey(
  prfKey: Uint8Array,
  data: string,
): Promise<string> {
  // Use first 32 bytes of PRF output as AES-256 key
  const keyMaterial = prfKey.slice(0, 32);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Generate random IV
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encodedData = new TextEncoder().encode(data);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData,
  );

  // Combine IV and encrypted data, then encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt data using AES-GCM with PRF-derived key
 */
export async function decryptWithPrfKey(
  prfKey: Uint8Array,
  encryptedData: string,
): Promise<string> {
  // Use first 32 bytes of PRF output as AES-256 key
  const keyMaterial = prfKey.slice(0, 32);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.subarray(0, 12);
  const encrypted = combined.subarray(12);

  // Decrypt the data
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// Master Key Management
// ============================================================================

// Storage key for wrapped master key
const WRAPPED_MASTER_KEY_KEY = '$secure_wrapped_master_key$';

// Master key length (32 bytes = 256 bits for AES-256)
const MASTER_KEY_LENGTH = 32;

/**
 * Generate a random master key
 */
export function generateMasterKey(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(MASTER_KEY_LENGTH));
}

/**
 * Wrap (encrypt) master key with PRF key
 * Returns base64-encoded wrapped master key
 */
export async function wrapMasterKey(
  prfKey: Uint8Array,
  masterKey: Uint8Array,
): Promise<string> {
  // Use first 32 bytes of PRF output as wrapping key
  const wrappingKeyMaterial = prfKey.slice(0, 32);

  const wrappingKey = await globalThis.crypto.subtle.importKey(
    'raw',
    wrappingKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Generate random IV for wrapping
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the master key
  const wrapped = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    masterKey as BufferSource,
  );

  // Combine IV and wrapped key, then encode as base64
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrapped), iv.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Unwrap (decrypt) master key with PRF key
 * Returns the master key as Uint8Array
 */
export async function unwrapMasterKey(
  prfKey: Uint8Array,
  wrappedMasterKey: string,
): Promise<Uint8Array> {
  // Use first 32 bytes of PRF output as wrapping key
  const wrappingKeyMaterial = prfKey.slice(0, 32);

  const wrappingKey = await globalThis.crypto.subtle.importKey(
    'raw',
    wrappingKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Decode from base64
  const combined = Buffer.from(wrappedMasterKey, 'base64');

  // Extract IV (first 12 bytes) and wrapped key
  const iv = combined.subarray(0, 12);
  const wrapped = combined.subarray(12);

  // Decrypt the master key
  const unwrapped = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    wrapped,
  );

  return new Uint8Array(unwrapped);
}

/**
 * Encrypt data using AES-GCM with master key
 */
export async function encryptWithMasterKey(
  masterKey: Uint8Array,
  data: string,
): Promise<string> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Generate random IV
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encodedData = new TextEncoder().encode(data);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData,
  );

  // Combine IV and encrypted data, then encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt data using AES-GCM with master key
 */
export async function decryptWithMasterKey(
  masterKey: Uint8Array,
  encryptedData: string,
): Promise<string> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.subarray(0, 12);
  const encrypted = combined.subarray(12);

  // Decrypt the data
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
}

export { PRF_CREDENTIAL_ID_KEY, PRF_SALT_KEY, WRAPPED_MASTER_KEY_KEY };
