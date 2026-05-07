import { createDecipheriv } from 'node:crypto';

import {
  encodeSensitiveTextAsync,
  encryptRevealableSeed,
} from '@onekeyhq/core/src/secret';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret/bip39';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { secureWipe } from '../../core/crypto-utils';
import {
  type ISecureCacheKey,
  type SecureCache,
  createSecureCacheKey,
  secureCache,
} from '../../core/secure-cache';
import { AppError, ERROR_CODES } from '../../errors';
import { decideCacheAction } from '../../infra/vault/cache';
import { VaultClient } from '../../infra/vault/client';
import { VaultClientError } from '../../infra/vault/errors';
import {
  BOT_WALLET_KEY_SERVICE_BASE_URL,
  serviceFetch,
} from '../../infra/vault/service-client';
import { CLI_PASSWORD } from '../keychain-keys';

import type { IVaultMutationResult } from '../../infra/vault/client';
import type {
  IFetchBotWalletKeyInput,
  IServiceFailSecureCause,
  IServiceResponse,
  IServiceSelfHealReason,
} from '../../infra/vault/service-client';
import type {
  IVaultCacheEntry,
  IVaultPlaintext,
  IVaultRecord,
} from '../../infra/vault/types';
import type {
  ISignTransactionPayload,
  ISigner,
  ISignerGetAddressOptions,
} from '../types';

const CREDENTIAL_ALGORITHM = 'aes-256-gcm';
const CREDENTIAL_KEY_BYTES = 32;
const CREDENTIAL_NONCE_BYTES = 12;
const CREDENTIAL_TAG_BYTES = 16;

type IVaultClientLike = Pick<VaultClient, 'atomicMutate'>;
type ISessionCacheLike = Pick<SecureCache, 'get' | 'set'>;
type IFetchBotWalletKey = (
  input: IFetchBotWalletKeyInput,
) => Promise<{ keyBase64: string } | IServiceResponse>;
type IEncodeRevealableSeed = (seed: IBip39RevealableSeed) => Promise<string>;
type IDecryptBotWalletCredential = (
  ciphertextBase64: string,
  keyBase64: string,
) => Promise<string>;
type ITriggerSelfHeal = (reason: IServiceSelfHealReason) => Promise<never>;
type ISecureWipe = (buffer: Buffer) => void;
type IServiceSelfHealRequiredError = Error & {
  reason: IServiceSelfHealReason;
  serviceSelfHealRequired: true;
};

export type ISignerSoftwareBaseOptions = {
  vaultClient?: IVaultClientLike;
  sessionCache?: ISessionCacheLike;
  fetchKey?: IFetchBotWalletKey;
  decryptCredential?: IDecryptBotWalletCredential;
  encodeRevealableSeed?: IEncodeRevealableSeed;
  selfHeal?: ITriggerSelfHeal;
  secureWipe?: ISecureWipe;
  now?: () => number;
};

function createUnauthenticatedError(): AppError {
  return new AppError(
    ERROR_CODES.NOT_AUTHENTICATED.code,
    'No authenticated wallet found. Log in first.',
    'Run: onekey auth login --app-transfer',
  );
}

function createInvalidSessionError(message: string): AppError {
  return new AppError(
    ERROR_CODES.AUTH_SESSION_INVALID.code,
    message,
    'Run: onekey auth logout, then import the Bot Wallet again.',
  );
}

function describeServiceFailureCause(
  cause: IServiceFailSecureCause | undefined,
): string {
  switch (cause?.code) {
    case 'ECONNREFUSED':
      return 'connection refused';
    case 'ECONNRESET':
      return 'connection reset';
    case 'ETIMEDOUT':
    case 'ECONNABORTED':
      return 'request timed out';
    case 'ENETUNREACH':
      return 'network unreachable';
    case 'EHOSTUNREACH':
      return 'host unreachable';
    case 'ENOTFOUND':
      return 'host not found';
    case 'ERR_INVALID_URL':
      return 'invalid service URL';
    default:
      break;
  }
  if (cause?.message) {
    return cause.message;
  }
  if (cause?.code) {
    return cause.code;
  }
  return 'unknown network error';
}

function createServiceUnreachableError(
  cause?: IServiceFailSecureCause,
): AppError {
  const reason = describeServiceFailureCause(cause);
  return new AppError(
    ERROR_CODES.SERVICE_UNREACHABLE.code,
    `Cannot reach Bot Wallet key service at ${BOT_WALLET_KEY_SERVICE_BASE_URL} (${reason}).`,
    `Make sure the local Bot Wallet key service is running on ${BOT_WALLET_KEY_SERVICE_BASE_URL}, then retry.`,
    {
      details: {
        endpoint: BOT_WALLET_KEY_SERVICE_BASE_URL,
        ...(cause?.code !== undefined && { causeCode: cause.code }),
        ...(cause?.message !== undefined && { causeMessage: cause.message }),
      },
    },
  );
}

function getDefaultNow(): () => number {
  const raw = process.env.ONEKEY_CLI_TEST_NOW_MS;
  if (raw && /^\d+$/.test(raw)) {
    return () => Number(raw);
  }
  return Date.now;
}

function safeSecureWipe(wipe: ISecureWipe, buffer: Buffer | undefined): void {
  if (!buffer) {
    return;
  }
  try {
    wipe(buffer);
  } catch {
    // Cleanup must never mask the original vault/service failure.
  }
}

function createServiceSelfHealRequiredError(
  reason: IServiceSelfHealReason,
): IServiceSelfHealRequiredError {
  return Object.assign(new OneKeyLocalError(reason), {
    name: 'ServiceSelfHealRequired',
    reason,
    serviceSelfHealRequired: true as const,
  });
}

function isServiceSelfHealRequiredError(
  error: unknown,
): error is IServiceSelfHealRequiredError {
  return (
    error instanceof Error &&
    'serviceSelfHealRequired' in error &&
    error.serviceSelfHealRequired === true
  );
}

function mapVaultError(error: unknown): Error {
  if (error instanceof VaultClientError) {
    switch (error.code) {
      case 'NOT_AUTHENTICATED':
        return createUnauthenticatedError();
      case 'VAULT_MISSING':
        return new AppError(
          ERROR_CODES.VAULT_MISSING.code,
          'Bot Wallet vault is missing.',
          'Run auth login with a fresh Bot Wallet CLI payload.',
        );
      case 'VAULT_CORRUPT':
        return new AppError(
          ERROR_CODES.VAULT_CORRUPT.code,
          'Bot Wallet vault is corrupt.',
          'Run auth logout, then import the Bot Wallet again.',
        );
      case 'VAULT_WRITE_FAILED':
        return new AppError(
          ERROR_CODES.VAULT_WRITE_FAILED.code,
          'Bot Wallet vault write failed.',
          'Check local disk permissions and available space, then retry.',
        );
      default: {
        const exhaustive: never = error.code;
        return createInvalidSessionError(exhaustive);
      }
    }
  }
  return error instanceof Error ? error : new OneKeyLocalError(String(error));
}

function normalizeFetchResult(
  result: { keyBase64: string } | IServiceResponse,
): IServiceResponse {
  if ('kind' in result) {
    return result;
  }
  return { kind: 'ok', keyBase64: result.keyBase64 };
}

async function defaultTriggerSelfHeal(
  reason: IServiceSelfHealReason,
): Promise<never> {
  const { triggerSelfHeal } =
    await import('../../commands/auth/_internal/self-heal');
  return triggerSelfHeal(reason);
}

function readActiveRecord(vault: IVaultPlaintext): {
  activeKeyId: string;
  activeWalletId: string;
  cacheKey: ISecureCacheKey;
  record: IVaultRecord;
} {
  const activeKeyId = vault.metadata.activeKeyId;
  const activeWalletId = vault.metadata.activeWalletId;
  if (!activeKeyId || !activeWalletId) {
    throw createUnauthenticatedError();
  }

  const record = vault.records[activeKeyId];
  if (!record) {
    throw createInvalidSessionError('Active Bot Wallet record is missing.');
  }

  return {
    activeKeyId,
    activeWalletId,
    cacheKey: createSecureCacheKey(activeWalletId, activeKeyId),
    record,
  };
}

function cloneVaultWithCacheEntry(
  vault: IVaultPlaintext,
  cacheKey: ISecureCacheKey,
  cacheEntry: IVaultCacheEntry,
): IVaultPlaintext {
  return {
    ...vault,
    cache: {
      ...vault.cache,
      [cacheKey]: cacheEntry,
    },
  };
}

function decodeCredentialBlob(ciphertextBase64: string): {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
} {
  const blob = Buffer.from(ciphertextBase64, 'base64');
  if (blob.length < CREDENTIAL_NONCE_BYTES + CREDENTIAL_TAG_BYTES) {
    throw createInvalidSessionError(
      'Bot Wallet credential ciphertext is invalid.',
    );
  }

  return {
    nonce: blob.subarray(0, CREDENTIAL_NONCE_BYTES),
    ciphertext: blob.subarray(
      CREDENTIAL_NONCE_BYTES,
      blob.length - CREDENTIAL_TAG_BYTES,
    ),
    tag: blob.subarray(blob.length - CREDENTIAL_TAG_BYTES),
  };
}

export async function decryptBotWalletCredentialToHdCredential(
  ciphertextBase64: string,
  keyBase64: string,
  encodeSeed: IEncodeRevealableSeed = (seed) =>
    encryptRevealableSeed({ rs: seed, password: CLI_PASSWORD }),
): Promise<string> {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== CREDENTIAL_KEY_BYTES) {
    safeSecureWipe(secureWipe, key);
    throw createInvalidSessionError('Bot Wallet service key is invalid.');
  }

  let plaintext: Buffer | undefined;
  try {
    const { nonce, ciphertext, tag } = decodeCredentialBlob(ciphertextBase64);
    const decipher = createDecipheriv(CREDENTIAL_ALGORITHM, key, nonce);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const seed = JSON.parse(
      plaintext.toString('utf-8'),
    ) as IBip39RevealableSeed;
    return await encodeSeed(seed);
  } catch (error) {
    throw createInvalidSessionError(
      error instanceof Error
        ? error.message
        : 'Bot Wallet credential decrypt failed.',
    );
  } finally {
    safeSecureWipe(secureWipe, key);
    safeSecureWipe(secureWipe, plaintext);
  }
}

/**
 * Shared base for software signers (HD today; imported / watching in the
 * future). Owns the Bot Wallet vault resolution + password helpers every
 * software signer needs. Concrete chain implementations live under
 * `signer/impls/<chain>/SignerHd.ts` and only implement the three `ISigner`
 * methods.
 *
 * Kit-bg analogue: `KeyringSoftwareBase`. The kit-bg pattern keeps a
 * separate marker subclass per wallet kind (`KeyringHdBase`,
 * `KeyringImportedBase`); we don't have a wallet-kind enum yet, so HD
 * extends this base directly until a second software wallet kind lands.
 */
export class SignerSoftwareBase implements ISigner {
  private readonly vaultClient: IVaultClientLike;

  private readonly sessionCache: ISessionCacheLike;

  private readonly fetchKey: IFetchBotWalletKey;

  private readonly decryptCredential: IDecryptBotWalletCredential;

  private readonly selfHeal: ITriggerSelfHeal;

  private readonly secureWipe: ISecureWipe;

  private readonly now: () => number;

  private activeCacheKey: ISecureCacheKey | null = null;

  constructor(options: ISignerSoftwareBaseOptions = {}) {
    this.vaultClient = options.vaultClient ?? new VaultClient();
    this.sessionCache = options.sessionCache ?? secureCache;
    this.fetchKey = options.fetchKey ?? serviceFetch;
    this.decryptCredential =
      options.decryptCredential ??
      ((ciphertextBase64, keyBase64) =>
        decryptBotWalletCredentialToHdCredential(
          ciphertextBase64,
          keyBase64,
          options.encodeRevealableSeed,
        ));
    this.selfHeal = options.selfHeal ?? defaultTriggerSelfHeal;
    this.secureWipe = options.secureWipe ?? secureWipe;
    this.now = options.now ?? getDefaultNow();
  }

  getAddress(
    _networkId: string,
    _options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    return Promise.reject(
      new Error('SignerSoftwareBase.getAddress must be overridden'),
    );
  }

  signTransaction(_payload: ISignTransactionPayload): Promise<ISignedTxPro> {
    return Promise.reject(
      new Error('SignerSoftwareBase.signTransaction must be overridden'),
    );
  }

  signMessage(_payload: ICoreApiSignMsgPayload): Promise<string> {
    return Promise.reject(
      new Error('SignerSoftwareBase.signMessage must be overridden'),
    );
  }

  async getEncodedPassword(): Promise<string> {
    return encodeSensitiveTextAsync({ text: CLI_PASSWORD });
  }

  async getHdCredential(): Promise<string> {
    if (this.activeCacheKey) {
      const cached = this.sessionCache.get(this.activeCacheKey);
      if (cached) {
        return cached.toString('utf-8');
      }
    }

    try {
      const hdCredential = await this.vaultClient.atomicMutate((vault) =>
        this.resolveHdCredentialFromVault(vault),
      );
      if (this.activeCacheKey) {
        this.sessionCache.set(
          this.activeCacheKey,
          Buffer.from(hdCredential, 'utf-8'),
        );
      }
      return hdCredential;
    } catch (error) {
      if (isServiceSelfHealRequiredError(error)) {
        return this.selfHeal(error.reason);
      }
      throw mapVaultError(error);
    }
  }

  protected baseGetEncodedPassword(): Promise<string> {
    return this.getEncodedPassword();
  }

  protected baseGetHdCredential(): Promise<string> {
    return this.getHdCredential();
  }

  private async resolveHdCredentialFromVault(
    vault: IVaultPlaintext,
  ): Promise<IVaultMutationResult<string>> {
    const { activeKeyId, cacheKey, record } = readActiveRecord(vault);
    this.activeCacheKey = cacheKey;
    const now = this.now();
    const cached = vault.cache[cacheKey];
    const decision = decideCacheAction(cached, now);

    if (decision.kind === 'hit-no-write') {
      return {
        nextVault: vault,
        result: decision.entry.hdCredentialBlob,
        shouldWrite: false,
      };
    }

    if (decision.kind === 'hit-refresh') {
      const nextVault = cloneVaultWithCacheEntry(
        vault,
        cacheKey,
        decision.nextEntry,
      );
      return {
        nextVault,
        result: decision.nextEntry.hdCredentialBlob,
      };
    }

    let accessTokenBuffer: Buffer | undefined = Buffer.from(
      record.accessToken,
      'utf-8',
    );
    let keyBase64Buffer: Buffer | undefined;
    let hdCredentialBuffer: Buffer | undefined;

    try {
      const fetchResult = normalizeFetchResult(
        await this.fetchKey({
          accessToken: record.accessToken,
          keyId: activeKeyId,
        }),
      );
      if (fetchResult.kind === 'self-heal') {
        throw createServiceSelfHealRequiredError(fetchResult.reason);
      }
      if (fetchResult.kind === 'fail-secure') {
        throw createServiceUnreachableError(fetchResult.cause);
      }

      const { keyBase64 } = fetchResult;
      keyBase64Buffer = Buffer.from(keyBase64, 'utf-8');
      const hdCredential = await this.decryptCredential(
        record.ciphertextBase64,
        keyBase64,
      );
      hdCredentialBuffer = Buffer.from(hdCredential, 'utf-8');
      const nextEntry: IVaultCacheEntry = {
        hdCredentialBlob: hdCredential,
        issuedAt: now,
        expiresAt: now + 60 * 60 * 1000,
      };
      const nextVault = cloneVaultWithCacheEntry(vault, cacheKey, nextEntry);

      return {
        nextVault,
        result: hdCredential,
      };
    } finally {
      safeSecureWipe(this.secureWipe, accessTokenBuffer);
      safeSecureWipe(this.secureWipe, keyBase64Buffer);
      safeSecureWipe(this.secureWipe, hdCredentialBuffer);
      accessTokenBuffer = undefined;
      keyBase64Buffer = undefined;
      hdCredentialBuffer = undefined;
    }
  }
}
