import bufferUtils from '../../utils/bufferUtils';
import {
  INDEXED_DB_CRYPTO_KEY_AES_GCM_NONCE_BYTES,
  getCryptoGlobal,
  getOrCreateCryptoKey,
  toWebCryptoBytes,
} from '../indexedDbCryptoKeyStore';

/**
 * Device-key sealing for the SupabaseStorage NON-secure-storage fallback path
 * (browser extension / web / dev desktop, where the OAuth session would
 * otherwise sit as plaintext in appStorage on disk).
 *
 * The value is AES-256-GCM encrypted with a NON-EXTRACTABLE WebCrypto
 * CryptoKey persisted in IndexedDB (see `indexedDbCryptoKeyStore` — the same
 * origin-shared device-key database used by the kit-bg local secret envelope
 * credential wrapping, under a dedicated keyRef). This defeats pure
 * disk-read attacks without requiring a user password or unlock.
 *
 * Why a DEVICE key and not the user's passcode (do not "harden" this to
 * passcode encryption): the sealed value is the Supabase session whose
 * refresh token must be readable by the bg runtime's UNATTENDED token
 * refresh (access tokens expire in ~1h; without silent refresh every
 * OneKey ID API call starts failing and the rotating refresh token
 * eventually becomes unrecoverable — see the rationale block in
 * utils/supabaseClientUtils.ts). No user is present to type a passcode at
 * refresh time, so any scheme readable by unattended app code is the
 * ceiling here; the non-extractable device key achieves that ceiling while
 * still defeating disk-copy attacks. Wallet recovery additionally requires
 * the server-side rate-limited PIN, so a stolen session alone cannot move
 * assets.
 *
 * Runtime model (per repo policy, label runtime assumptions explicitly):
 * both extension JS runtimes — `bg` (service worker) and `main` (UI pages) —
 * share the SAME origin IndexedDB, so they resolve one shared persisted
 * device key (single shared browser-native resource); each runtime only
 * holds its own opaque in-memory CryptoKey handle (per-runtime JS-heap
 * copy). On web/desktop there is a single Standalone runtime.
 */

// Recognition marker for sealed values. Legacy plaintext supabase session
// values are JSON documents starting with '{', so a prefixed value can never
// be confused with a legacy one, and vice versa.
export const SUPABASE_SEALED_VALUE_PREFIX = 'onekey_sealed::';

const SUPABASE_STORAGE_DEVICE_KEY_REF = 'onekey:supabase-storage:device-key:v1';

// Versioned envelope stored after the prefix, so the format can evolve
// without breaking recognition of existing values.
type ISealedValueEnvelopeV1 = {
  v: 1;
  iv: string; // base64, fresh random 12-byte AES-GCM nonce per write
  data: string; // base64 ciphertext (+ GCM tag)
};

export type ISupabaseSealedValueCodec = {
  /** Whether a stored value is a recognized sealed envelope. */
  isSealedValue: (value: string) => boolean;
  /**
   * Seal `value` with the device key. Returns null when the device-key
   * mechanism is unavailable (no WebCrypto / no IndexedDB) — the caller must
   * then fall back to storing plaintext, matching pre-sealing behavior.
   */
  sealValue: (params: { key: string; value: string }) => Promise<string | null>;
  /**
   * Unseal a recognized envelope. Returns null when decryption genuinely
   * fails (device key lost/cleared, corrupt envelope) — the session is
   * unrecoverable and the user must re-OAuth.
   */
  unsealValue: (params: {
    key: string;
    sealedValue: string;
  }) => Promise<string | null>;
};

function parseSealedValueEnvelope(
  sealedValue: string,
): ISealedValueEnvelopeV1 | null {
  if (!sealedValue.startsWith(SUPABASE_SEALED_VALUE_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      sealedValue.slice(SUPABASE_SEALED_VALUE_PREFIX.length),
    ) as Partial<ISealedValueEnvelopeV1> | null;
    if (
      parsed &&
      parsed.v === 1 &&
      typeof parsed.iv === 'string' &&
      typeof parsed.data === 'string'
    ) {
      return parsed as ISealedValueEnvelopeV1;
    }
  } catch {
    // Recognized prefix but unparseable payload: handled by the caller as a
    // genuine (unrecoverable) sealed-value failure, never as legacy plaintext.
  }
  return null;
}

export function buildSupabaseSealedValueCodec({
  cryptoGlobal,
  dbName,
  indexedDBInstance,
  keyRef = SUPABASE_STORAGE_DEVICE_KEY_REF,
}: {
  cryptoGlobal?: Crypto | null;
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef?: string;
} = {}): ISupabaseSealedValueCodec {
  // Availability + key resolution are cached for the process lifetime (per
  // JS runtime): the first failure pins this runtime to the plaintext
  // fallback, the first success pins the shared persisted device key.
  let deviceKeyPromise: Promise<CryptoKey | null> | undefined;

  const getDeviceKey = async (): Promise<CryptoKey | null> => {
    if (!deviceKeyPromise) {
      deviceKeyPromise = (async () => {
        try {
          // getOrCreateCryptoKey validates WebCrypto + IndexedDB availability
          // and races safely against the other runtime (single readwrite
          // transaction), so both runtimes converge on one persisted key.
          return await getOrCreateCryptoKey({
            cryptoGlobal,
            dbName,
            indexedDBInstance,
            keyRef,
          });
        } catch (error) {
          console.error(
            'SupabaseStorage sealed-value device key unavailable, falling back to plaintext storage:',
            error,
          );
          return null;
        }
      })();
    }
    return deviceKeyPromise;
  };

  return {
    isSealedValue: (value: string) =>
      value.startsWith(SUPABASE_SEALED_VALUE_PREFIX),

    sealValue: async ({ key, value }: { key: string; value: string }) => {
      const deviceKey = await getDeviceKey();
      if (!deviceKey) {
        return null;
      }
      try {
        const cryptoInstance = getCryptoGlobal(cryptoGlobal);
        const iv = new Uint8Array(INDEXED_DB_CRYPTO_KEY_AES_GCM_NONCE_BYTES);
        cryptoInstance.getRandomValues(iv);
        const encrypted = await cryptoInstance.subtle.encrypt(
          {
            // Bind the ciphertext to its storage key so a sealed value cannot
            // be transplanted onto another storage key on disk.
            additionalData: toWebCryptoBytes(bufferUtils.utf8ToBytes(key)),
            iv,
            name: 'AES-GCM',
          },
          deviceKey,
          toWebCryptoBytes(bufferUtils.utf8ToBytes(value)),
        );
        const envelope: ISealedValueEnvelopeV1 = {
          v: 1,
          iv: bufferUtils.bytesToBase64(iv),
          data: bufferUtils.bytesToBase64(new Uint8Array(encrypted)),
        };
        return `${SUPABASE_SEALED_VALUE_PREFIX}${JSON.stringify(envelope)}`;
      } catch (error) {
        console.error(
          'SupabaseStorage sealed-value encrypt failed, falling back to plaintext storage:',
          error,
        );
        return null;
      }
    },

    unsealValue: async ({
      key,
      sealedValue,
    }: {
      key: string;
      sealedValue: string;
    }) => {
      const envelope = parseSealedValueEnvelope(sealedValue);
      if (!envelope) {
        console.error(
          'SupabaseStorage sealed-value envelope unparseable, treating session as lost',
        );
        return null;
      }
      const deviceKey = await getDeviceKey();
      if (!deviceKey) {
        console.error(
          'SupabaseStorage sealed value present but device key unavailable, treating session as lost',
        );
        return null;
      }
      try {
        const cryptoInstance = getCryptoGlobal(cryptoGlobal);
        const decrypted = await cryptoInstance.subtle.decrypt(
          {
            additionalData: toWebCryptoBytes(bufferUtils.utf8ToBytes(key)),
            iv: toWebCryptoBytes(bufferUtils.base64ToBytes(envelope.iv)),
            name: 'AES-GCM',
          },
          deviceKey,
          toWebCryptoBytes(bufferUtils.base64ToBytes(envelope.data)),
        );
        return bufferUtils.bytesToUtf8(new Uint8Array(decrypted), {
          checkIsValidUtf8: true,
        });
      } catch (error) {
        // Wrong/lost device key (e.g. browser cleared IndexedDB but not
        // appStorage): the session is unrecoverable; returning null makes the
        // user re-OAuth instead of looping on data that can never decrypt.
        console.error(
          'SupabaseStorage sealed-value decrypt failed, treating session as lost:',
          error,
        );
        return null;
      }
    },
  };
}
