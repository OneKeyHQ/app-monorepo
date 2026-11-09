import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

import {
  HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX,
  HARDWARE_CLOUD_SYNC_KEK_VERSION,
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  assertHardwareCloudSyncAuthContext,
  isHardwareCloudSyncKekSalt,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import type { IHardwareCloudSyncAuthContext } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncLocalError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  IHardwareCloudSyncDeviceKeyJwk,
  IHardwareCloudSyncSession,
} from '@onekeyhq/shared/types/keylessCloudSync';

import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  createHardwareCloudSyncDataError,
  createHardwareCloudSyncDiagnostic,
  getHardwareCloudSyncErrorDiagnostics,
  logHardwareCloudSyncDiagnostic,
} from './hardwareCloudSyncLog';

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const AUTH_BASE = '/prime/v1/hw-sync/auth';
const ENVELOPE_ITEM_ID = 'hardware-cloud-dek';
// Refresh a little early so a request never races the expiry.
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
// Half the 60 seconds the server allows a proof's time: a refused proof that
// was this far off the re-measured server clock was refused for its time.
const PROOF_CLOCK_RETRY_THRESHOLD_MS = 30 * 1000;

type ITokenResponse = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  sessionId: string;
};

type IKeyEnvelope = {
  dekId: string;
  kekVersion: 1;
  // Part of the message the device signs for this envelope's KEK.
  kekSalt: string;
  // Starts at 1 and grows by one on each reset. It is bound into the wrapped
  // key, so the server cannot relabel an older envelope as newer.
  generation: number;
  wrappedDek: string;
  createdAt: number;
};

// Called inside the open device session; signs the salted key message.
export type IHardwareCloudSyncKekDeriver = (kekSalt: string) => Promise<string>;

// The renderer's Buffer polyfill has no 'base64url' encoding.
const toBase64url = (bytes: Uint8Array | string) =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64url = (value: string) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function randomHex(length: number) {
  return bufferUtils.bytesToHex(p256.utils.randomPrivateKey()).slice(0, length);
}

export function createHardwareCloudSyncDeviceKey(): IHardwareCloudSyncDeviceKeyJwk {
  const d = p256.utils.randomPrivateKey();
  const point = p256.getPublicKey(d, false);
  return {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64url(point.slice(1, 33)),
    y: toBase64url(point.slice(33, 65)),
    d: toBase64url(d),
  };
}

export function getHardwareCloudSyncDevicePublicJwk(
  jwk: IHardwareCloudSyncDeviceKeyJwk,
) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

// The server checks proof and challenge times against its own clock, and many
// devices run minutes or hours off it. Local clock until the server's is known.
function getServerClockOffsetMs(): number {
  const estimated = systemTimeUtils.getEstimatedServerTime();
  return estimated === undefined ? 0 : estimated - Date.now();
}

async function measureServerClockOffsetMs({
  force,
}: { force?: boolean } = {}): Promise<number> {
  try {
    if (force) {
      await systemTimeUtils.refreshServerTime();
    } else {
      await systemTimeUtils.ensureFreshServerTime();
    }
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
  }
  return getServerClockOffsetMs();
}

function buildPossessionProof({
  jwk,
  htm,
  htu,
  accessToken,
  now,
}: {
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  htm: string;
  htu: string;
  accessToken?: string;
  now: number;
}): string {
  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: getHardwareCloudSyncDevicePublicJwk(jwk),
  };
  const payload: Record<string, unknown> = {
    htm,
    htu,
    iat: Math.floor(now / 1000),
    jti: randomHex(32),
  };
  if (accessToken) {
    payload.ath = toBase64url(sha256(Buffer.from(accessToken, 'utf8')));
  }
  const input = `${toBase64url(stringUtils.stableStringify(header))}.${toBase64url(
    stringUtils.stableStringify(payload),
  )}`;
  const signature = p256.sign(
    sha256(Buffer.from(input, 'utf8')),
    fromBase64url(jwk.d),
  );
  return `${input}.${toBase64url(signature.toCompactRawBytes())}`;
}

function getHtu(client: AxiosInstance, urlPath: string) {
  const url = new URL(urlPath, client.defaults.baseURL);
  return `${url.origin}${url.pathname}`;
}

async function request<T>(params: {
  client: AxiosInstance;
  method: 'GET' | 'POST';
  urlPath: string;
  data?: unknown;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  accessToken?: string;
}): Promise<T> {
  return (await requestRaw<T>(params)).data.data;
}

async function requestRaw<T>({
  client,
  method,
  urlPath,
  data,
  jwk,
  accessToken,
}: {
  client: AxiosInstance;
  method: 'GET' | 'POST';
  urlPath: string;
  data?: unknown;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  accessToken?: string;
}): Promise<AxiosResponse<IApiClientResponse<T>>> {
  const diagnostic = createHardwareCloudSyncDiagnostic();
  // A fixed route classification avoids logging URLs, query data, or account IDs.
  const route = [
    '/prime/v1/sync/lock',
    '/prime/v1/sync/download',
    '/prime/v1/sync/check',
    '/prime/v1/sync/upload',
    '/prime/v1/sync/flush',
    `${AUTH_BASE}/refresh`,
    `${AUTH_BASE}/revoke`,
    `${AUTH_BASE}/challenge`,
    `${AUTH_BASE}/verify`,
  ].indexOf(urlPath);
  const stages = [
    'request_lock',
    'request_download',
    'request_check',
    'request_upload',
    'request_flush',
    'request_refresh',
    'request_revoke',
    'request_challenge',
    'request_verify',
  ];
  diagnostic(stages[route] ?? 'request_other');
  const send = (clockOffsetMs: number) => {
    const headers: Record<string, string> = {
      DPoP: buildPossessionProof({
        jwk,
        htm: method,
        htu: getHtu(client, urlPath),
        accessToken,
        now: Date.now() + clockOffsetMs,
      }),
    };
    if (accessToken) {
      headers.Authorization = `DPoP ${accessToken}`;
    }
    const config: AxiosRequestConfig = { headers };
    return method === 'GET'
      ? client.get<IApiClientResponse<T>>(urlPath, config)
      : client.post<IApiClientResponse<T>>(urlPath, data, config);
  };
  const clockOffsetMs = await measureServerClockOffsetMs();
  try {
    const response = await send(clockOffsetMs);
    diagnostic('request_success', { httpStatus: response.status });
    return response;
  } catch (error) {
    // A proof with a stale time is refused like a bad token, for example when
    // the estimate predates a sleep. Resend once only if the re-measured clock
    // explains it; the new proof is not a replay of the refused one.
    diagnostic('request_failed', {
      ...getHardwareCloudSyncErrorDiagnostics(error),
      unauthorized: isHardwareCloudSyncUnauthorizedError(error),
    });
    if (!isHardwareCloudSyncUnauthorizedError(error)) throw error;
    const measured = await measureServerClockOffsetMs({ force: true });
    if (Math.abs(measured - clockOffsetMs) < PROOF_CLOCK_RETRY_THRESHOLD_MS) {
      diagnostic('request_clock_retry_skipped', { clockRetry: false });
      throw error;
    }
    diagnostic('request_clock_retry', { clockRetry: true });
    try {
      const response = await send(measured);
      diagnostic('request_clock_retry_success', {
        httpStatus: response.status,
      });
      return response;
    } catch (retryError) {
      diagnostic('request_clock_retry_failed', {
        ...getHardwareCloudSyncErrorDiagnostics(retryError),
        unauthorized: isHardwareCloudSyncUnauthorizedError(retryError),
      });
      throw retryError;
    }
  }
}

function toSession(
  tokens: unknown,
  jwk: IHardwareCloudSyncDeviceKeyJwk,
  dekId: string,
): IHardwareCloudSyncSession {
  if (
    typeof tokens !== 'object' ||
    tokens === null ||
    !('accessToken' in tokens) ||
    typeof tokens.accessToken !== 'string' ||
    !tokens.accessToken.trim() ||
    !('refreshToken' in tokens) ||
    typeof tokens.refreshToken !== 'string' ||
    !tokens.refreshToken.trim() ||
    !('sessionId' in tokens) ||
    typeof tokens.sessionId !== 'string' ||
    !tokens.sessionId.trim() ||
    !('accessTokenExpiresIn' in tokens) ||
    typeof tokens.accessTokenExpiresIn !== 'number' ||
    !Number.isFinite(tokens.accessTokenExpiresIn) ||
    tokens.accessTokenExpiresIn <= 0
  ) {
    throw createHardwareCloudSyncDataError(
      'Invalid Cloud sync session response',
    );
  }
  const now = Date.now();
  const accessTokenExpiresAt = now + tokens.accessTokenExpiresIn * 1000;
  if (
    !Number.isFinite(accessTokenExpiresAt) ||
    accessTokenExpiresAt > Number.MAX_SAFE_INTEGER ||
    accessTokenExpiresAt <= now
  ) {
    throw createHardwareCloudSyncDataError(
      'Invalid Cloud sync session response',
    );
  }
  return {
    deviceKeyJwk: jwk,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    dekId,
  };
}

export async function requestHardwareCloudSyncChallenge({
  client,
  jwk,
  identityTag,
  env,
}: {
  client: AxiosInstance;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  identityTag: string;
  env: IHardwareCloudSyncAuthContext['env'];
}) {
  if (identityTag.length !== 16 || !/^[0-9a-f]{16}$/.test(identityTag)) {
    throw createHardwareCloudSyncDataError('Invalid standard wallet identity');
  }
  // Measured fresh: the challenge's expiry is checked against this clock
  // before the user is asked to sign it.
  const clockOffsetMs = await measureServerClockOffsetMs({ force: true });
  // The server recovers the identity key from the signature.
  const response = await client.post<
    IApiClientResponse<{ challengeId: string; message: string }>
  >(`${AUTH_BASE}/challenge`, {
    deviceKeyJwk: getHardwareCloudSyncDevicePublicJwk(jwk),
    identityTag,
  });
  const challenge = response.data.data;
  assertHardwareCloudSyncChallengeFor({
    message: challenge?.message,
    jwk,
    identityTag,
    env,
    now: Date.now() + clockOffsetMs,
  });
  if (
    typeof challenge?.challengeId !== 'string' ||
    !challenge.challengeId ||
    challenge.challengeId.length > 256
  ) {
    throw createHardwareCloudSyncDataError(
      'Invalid Cloud sync sign-in challenge',
    );
  }
  return challenge;
}

// RFC 7638 thumbprint of the DPoP public key, as the server derives it.
export function getHardwareCloudSyncDeviceKeyThumbprint(
  jwk: IHardwareCloudSyncDeviceKeyJwk,
): string {
  const { crv, kty, x, y } = jwk;
  return toBase64url(
    sha256(Buffer.from(stringUtils.stableStringify({ crv, kty, x, y }))),
  );
}

// A challenge is signed only for this request's own device key and while it is
// fresh, so a replayed or foreign challenge never reaches the device.
export function assertHardwareCloudSyncChallengeFor({
  message,
  jwk,
  identityTag,
  env,
  now = Date.now() + getServerClockOffsetMs(),
}: {
  message: string;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  identityTag: string;
  env: IHardwareCloudSyncAuthContext['env'];
  now?: number;
}): void {
  try {
    assertHardwareCloudSyncAuthContext(
      message,
      { identityTag, env, jkt: getHardwareCloudSyncDeviceKeyThumbprint(jwk) },
      now,
    );
  } catch {
    throw createHardwareCloudSyncDataError(
      'Invalid Cloud sync sign-in challenge: local context or expiry mismatch',
    );
  }
}

export async function verifyHardwareCloudSyncChallenge({
  client,
  jwk,
  challengeId,
  signature,
}: {
  client: AxiosInstance;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  challengeId: string;
  signature: string;
}): Promise<IHardwareCloudSyncSession> {
  const tokens = await request<ITokenResponse>({
    client,
    method: 'POST',
    urlPath: `${AUTH_BASE}/verify`,
    data: { challengeId, signature },
    jwk,
  });
  return toSession(tokens, jwk, '');
}

export async function refreshHardwareCloudSyncSessionIfNeeded({
  client,
  session,
  force,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  force?: boolean;
}): Promise<IHardwareCloudSyncSession | undefined> {
  if (
    !force &&
    session.accessTokenExpiresAt - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS
  ) {
    return undefined;
  }
  const tokens = await request<ITokenResponse>({
    client,
    method: 'POST',
    urlPath: `${AUTH_BASE}/refresh`,
    data: { refreshToken: session.refreshToken },
    jwk: session.deviceKeyJwk,
  });
  return toSession(tokens, session.deviceKeyJwk, session.dekId);
}

export async function requestRawWithHardwareCloudSyncSession<T>({
  client,
  session,
  method,
  urlPath,
  data,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  method: 'GET' | 'POST';
  urlPath: string;
  data?: unknown;
}): Promise<AxiosResponse<IApiClientResponse<T>>> {
  return requestRaw<T>({
    client,
    method,
    urlPath,
    data,
    jwk: session.deviceKeyJwk,
    accessToken: session.accessToken,
  });
}

export async function requestWithHardwareCloudSyncSession<T>(
  params: Parameters<typeof requestRawWithHardwareCloudSyncSession>[0],
): Promise<T> {
  return (await requestRawWithHardwareCloudSyncSession<T>(params)).data.data;
}

export async function revokeHardwareCloudSyncSession({
  client,
  session,
  scope,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  scope: 'current' | 'allExceptCurrent';
}) {
  return requestWithHardwareCloudSyncSession<{ revoked: number }>({
    client,
    session,
    method: 'POST',
    urlPath: `${AUTH_BASE}/revoke`,
    data: { scope },
  });
}

export function isHardwareCloudSyncKeyEnvelopeItem(item: {
  dataType?: string;
}): boolean {
  return item?.dataType === HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE;
}

type IEnvelopeContext = Pick<
  IKeyEnvelope,
  'dekId' | 'kekVersion' | 'kekSalt' | 'generation'
>;

// Binds the wrapped key to its envelope, so the server cannot pair one
// envelope's wrappedDek with another dekId.
function envelopeItemId({
  dekId,
  kekVersion,
  kekSalt,
  generation,
}: IEnvelopeContext) {
  return `${ENVELOPE_ITEM_ID}:v${kekVersion}:g${generation}:${dekId}:${kekSalt}`;
}

async function wrapDek({
  kek,
  dek,
  context,
}: {
  kek: string;
  dek: string;
  context: IEnvelopeContext;
}) {
  return keylessCloudSyncUtils.encryptWithKeylessKey({
    rawData: dek,
    encryptionKey: kek,
    itemId: envelopeItemId(context),
    dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  });
}

async function unwrapDek({
  kek,
  envelope,
}: {
  kek: string;
  envelope: IKeyEnvelope;
}) {
  let dek: string;
  try {
    dek = await keylessCloudSyncUtils.decryptWithKeylessKey({
      encryptedData: envelope.wrappedDek,
      encryptionKey: kek,
      itemId: envelopeItemId(envelope),
      dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
    });
  } catch {
    // This password is derived hardware key material, not the App passcode.
    throw createHardwareCloudSyncDataError(
      'Cloud sync key envelope could not be decrypted',
    );
  }
  if (!/^[0-9a-f]{64}$/.test(dek)) {
    throw createHardwareCloudSyncDataError('Invalid Cloud sync data key');
  }
  return dek;
}

// Identifies a key version from its id alone, so earlier envelopes (each with
// its own salt) never need unwrapping.
export function computeHardwareCloudSyncPwdHash(dekId: string): string {
  return `${HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX}${bufferUtils.bytesToHex(
    sha256(Buffer.from(dekId, 'utf8')),
  )}`;
}

// Only well-formed v1 envelopes are signed for: the salt is shown on the
// device, so the server must not choose arbitrary text there.
// Null for a malformed or legacy envelope, so callers that skip those do not
// log them as data check failures.
function readEnvelope(
  data: string | undefined,
  onInvalid?: (
    reason:
      | 'invalidJsonCount'
      | 'invalidShapeCount'
      | 'invalidVersionCount'
      | 'invalidIdCount'
      | 'invalidSaltCount'
      | 'invalidGenerationCount'
      | 'missingWrappedKeyCount',
  ) => void,
): IKeyEnvelope | undefined | null {
  if (!data) return undefined;
  let envelope: Partial<IKeyEnvelope> | undefined;
  try {
    envelope = JSON.parse(data) as Partial<IKeyEnvelope>;
  } catch {
    onInvalid?.('invalidJsonCount');
    envelope = undefined;
  }
  if (
    !envelope ||
    typeof envelope.dekId !== 'string' ||
    !/^[0-9a-f]{32}$/.test(envelope.dekId) ||
    envelope.kekVersion !== HARDWARE_CLOUD_SYNC_KEK_VERSION ||
    !isHardwareCloudSyncKekSalt(envelope.kekSalt) ||
    !Number.isSafeInteger(envelope.generation) ||
    (envelope.generation ?? 0) < 1 ||
    typeof envelope.wrappedDek !== 'string' ||
    !envelope.wrappedDek
  ) {
    if (!envelope) onInvalid?.('invalidShapeCount');
    else {
      if (
        typeof envelope.dekId !== 'string' ||
        !/^[0-9a-f]{32}$/.test(envelope.dekId)
      )
        onInvalid?.('invalidIdCount');
      if (envelope.kekVersion !== HARDWARE_CLOUD_SYNC_KEK_VERSION)
        onInvalid?.('invalidVersionCount');
      if (!isHardwareCloudSyncKekSalt(envelope.kekSalt))
        onInvalid?.('invalidSaltCount');
      if (
        !Number.isSafeInteger(envelope.generation) ||
        (envelope.generation ?? 0) < 1
      )
        onInvalid?.('invalidGenerationCount');
      if (typeof envelope.wrappedDek !== 'string' || !envelope.wrappedDek)
        onInvalid?.('missingWrappedKeyCount');
    }
    return null;
  }
  return envelope as IKeyEnvelope;
}

function parseEnvelope(data: string | undefined): IKeyEnvelope | undefined {
  const envelope = readEnvelope(data);
  if (envelope === null) {
    throw createHardwareCloudSyncDataError('Invalid Cloud sync key envelope');
  }
  return envelope;
}

export async function readLockEnvelope({
  client,
  session,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
}): Promise<IKeyEnvelope | undefined> {
  const { lock } = await requestWithHardwareCloudSyncSession<{
    lock: { data?: string } | null;
  }>({ client, session, method: 'GET', urlPath: '/prime/v1/sync/lock' });
  logHardwareCloudSyncDiagnostic('lock_received', { hasLock: !!lock?.data });
  const envelope = parseEnvelope(lock?.data);
  logHardwareCloudSyncDiagnostic('lock_parsed', {
    hasLock: !!envelope,
    generation: envelope?.generation,
  });
  return envelope;
}

// A new data key with its own salt; the device signs the salted message once
// per call of deriveKek.
async function createEnvelope(
  deriveKek: IHardwareCloudSyncKekDeriver,
  generation: number,
) {
  const dek = bufferUtils.bytesToHex(randomBytes(32));
  const dekId = bufferUtils.bytesToHex(randomBytes(16));
  const kekSalt = bufferUtils.bytesToHex(randomBytes(16));
  const kek = await deriveKek(kekSalt);
  const context: IEnvelopeContext = {
    dekId,
    kekVersion: HARDWARE_CLOUD_SYNC_KEK_VERSION,
    kekSalt,
    generation,
  };
  const envelope: IKeyEnvelope = {
    ...context,
    wrappedDek: await wrapDek({ kek, dek, context }),
    createdAt: Date.now(),
  };
  const dataKey: IHardwareCloudSyncDataKey = {
    dek,
    dekId,
    pwdHash: computeHardwareCloudSyncPwdHash(dekId),
  };
  return { dataKey, envelope };
}

// A Lock older than one this device already accepted for the wallet is a
// rollback to a key a reset was meant to retire.
function assertNotRolledBack(envelope: IKeyEnvelope, minGeneration: number) {
  if (envelope.generation < minGeneration) {
    throw createHardwareCloudSyncDataError(
      'Cloud sync key on the server is older than this device has seen',
    );
  }
}

function envelopeRecord(envelope: IKeyEnvelope) {
  return {
    key: `dek:${envelope.dekId}`,
    dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
    data: stringUtils.stableStringify(envelope),
    dataTimestamp: envelope.createdAt,
    isDeleted: false,
  };
}

// Earlier key versions on the server, known by dekId alone.
async function listPreviousPwdHashes({
  client,
  session,
  pwdHash,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  pwdHash: string;
}): Promise<string[]> {
  const { serverData } = await requestWithHardwareCloudSyncSession<{
    serverData: Array<{ dataType?: string; data?: string }>;
  }>({
    client,
    session,
    method: 'POST',
    urlPath: '/prime/v1/sync/download',
    data: { pwdHash, limit: 100_000 },
  });
  const hashes: string[] = [];
  let missingEnvelopeCount = 0;
  let invalidEnvelopeCount = 0;
  let currentEnvelopeCount = 0;
  const rejected = {
    invalidJsonCount: 0,
    invalidShapeCount: 0,
    invalidVersionCount: 0,
    invalidIdCount: 0,
    invalidSaltCount: 0,
    invalidGenerationCount: 0,
    missingWrappedKeyCount: 0,
  };
  const envelopes = (serverData ?? []).filter((item) =>
    isHardwareCloudSyncKeyEnvelopeItem(item),
  );
  for (const item of envelopes) {
    // A malformed or legacy envelope is not a key version of this wallet.
    const envelope = readEnvelope(item.data, (reason) => {
      rejected[reason] += 1;
    });
    if (envelope === undefined) missingEnvelopeCount += 1;
    if (envelope === null) invalidEnvelopeCount += 1;
    const hash = envelope
      ? computeHardwareCloudSyncPwdHash(envelope.dekId)
      : undefined;
    if (hash === pwdHash) currentEnvelopeCount += 1;
    if (hash && hash !== pwdHash) hashes.push(hash);
  }
  logHardwareCloudSyncDiagnostic('history_received_completeness_unknown', {
    ...rejected,
    requestedLimit: 100_000,
    returnedCount: serverData?.length ?? 0,
    envelopeCount: envelopes.length,
    missingEnvelopeCount,
    invalidEnvelopeCount,
    validEnvelopeCount:
      envelopes.length - missingEnvelopeCount - invalidEnvelopeCount,
    currentEnvelopeCount,
    previousEnvelopeCount: hashes.length,
    uniquePreviousCount: new Set(hashes).size,
    historyCompleteKnown: false,
  });
  return hashes;
}

/**
 * Returns the data key for this hardware identity, signing only after reading
 * the Lock. The first device creates the key and its salt; later devices sign
 * the salt they find. The server only ever sees the wrapped form.
 */
export async function bootstrapHardwareCloudSyncDataKey({
  client,
  session,
  deriveKek,
  minGeneration = 0,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  deriveKek: IHardwareCloudSyncKekDeriver;
  // Highest key generation this device accepted for the wallet.
  minGeneration?: number;
}): Promise<
  IHardwareCloudSyncDataKey & {
    generation: number;
    // Earlier keys of this wallet, after another device reset it.
    previousPwdHashes: string[];
  }
> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await readLockEnvelope({ client, session });
    if (existing) {
      logHardwareCloudSyncDiagnostic('bootstrap_existing_lock', {
        generation: existing.generation,
        minGeneration,
        attempt,
      });
      assertNotRolledBack(existing, minGeneration);
      logHardwareCloudSyncDiagnostic('bootstrap_derive_kek_started');
      const kek = await deriveKek(existing.kekSalt);
      logHardwareCloudSyncDiagnostic('bootstrap_unwrap_started');
      const dek = await unwrapDek({ kek, envelope: existing });
      logHardwareCloudSyncDiagnostic('bootstrap_unwrap_succeeded');
      const pwdHash = computeHardwareCloudSyncPwdHash(existing.dekId);
      return {
        dek,
        dekId: existing.dekId,
        pwdHash,
        generation: existing.generation,
        previousPwdHashes: await listPreviousPwdHashes({
          client,
          session,
          pwdHash,
        }),
      };
    }

    const { dataKey, envelope } = await createEnvelope(
      deriveKek,
      minGeneration + 1,
    );
    try {
      await requestWithHardwareCloudSyncSession({
        client,
        session,
        method: 'POST',
        urlPath: '/prime/v1/sync/flush',
        data: {
          nonce: 0,
          pwdHash: dataKey.pwdHash,
          // Only the first device may create the key; a concurrent first
          // enable loses here and signs the winner's salt instead.
          expectedPwdHash: '',
          lock: {
            key: 'lock',
            dataType: 'Lock',
            data: stringUtils.stableStringify(envelope),
            dataTimestamp: envelope.createdAt,
          },
          localData: [envelopeRecord(envelope)],
        },
      });
      return {
        ...dataKey,
        generation: envelope.generation,
        previousPwdHashes: [],
      };
    } catch (error) {
      if (!isHardwareCloudSyncPwdHashInvalidError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw createHardwareCloudSyncDataError('Cloud sync data key is unavailable');
}

export type IHardwareCloudSyncDataKey = {
  dek: string;
  dekId: string;
  pwdHash: string;
};

type IEncryptedSyncItem = {
  id: string;
  dataType: string;
  data?: string;
  pwdHash?: string;
};

// Prime answers hardware sync requests with HTTP 200 and one of its own 907xx
// codes, apart from the OneKey ID and Keyless ones.
// Any auth failure: challenge, signature, proof, token or revoked session.
export const HARDWARE_CLOUD_SYNC_UNAUTHORIZED_CODE = 90_700;
// Stale pwdHash: another device replaced the data key.
export const HARDWARE_CLOUD_SYNC_PWD_HASH_INVALID_CODE = 90_704;

function hasErrorCode(error: unknown, code: number) {
  return (error as { code?: unknown } | undefined)?.code === code;
}

export function isHardwareCloudSyncPwdHashInvalidError(error: unknown) {
  return hasErrorCode(error, HARDWARE_CLOUD_SYNC_PWD_HASH_INVALID_CODE);
}

export function isHardwareCloudSyncUnauthorizedError(error: unknown) {
  return hasErrorCode(error, HARDWARE_CLOUD_SYNC_UNAUTHORIZED_CODE);
}

/** Returns the data key the server currently holds, or undefined if none. */
export async function getCurrentHardwareCloudSyncDataKeyId({
  client,
  session,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
}): Promise<string | undefined> {
  const { lock } = await requestWithHardwareCloudSyncSession<{
    lock: { data?: string } | null;
  }>({ client, session, method: 'GET', urlPath: '/prime/v1/sync/lock' });
  return parseEnvelope(lock?.data)?.dekId;
}

/** Re-encrypts the items written with `from` under `to`. Others are dropped. */
export async function reencryptHardwareCloudSyncItems<
  T extends IEncryptedSyncItem,
>({
  items,
  from,
  to,
}: {
  items: T[];
  from: IHardwareCloudSyncDataKey;
  to: IHardwareCloudSyncDataKey;
}): Promise<T[]> {
  const result: T[] = [];
  const carried = items.filter((item) => item.pwdHash === from.pwdHash);
  for (const item of carried) {
    let { data } = item;
    if (data) {
      const raw = await keylessCloudSyncUtils.decryptWithKeylessKey({
        encryptedData: data,
        encryptionKey: from.dek,
        itemId: item.id,
        dataType: item.dataType,
      });
      data = await keylessCloudSyncUtils.encryptWithKeylessKey({
        rawData: raw,
        encryptionKey: to.dek,
        itemId: item.id,
        dataType: item.dataType,
      });
    }
    result.push({ ...item, data, pwdHash: to.pwdHash });
  }
  return result;
}

/**
 * Replaces the data key: everything on the server is re-encrypted with a new
 * DEK in one flush, guarded by the current pwdHash. Local records are
 * re-encrypted too and returned for the local database. `savePending` runs
 * before the flush so an interrupted reset can be finished or dropped later.
 */
export async function rotateHardwareCloudSyncDataKey<
  T extends IEncryptedSyncItem,
>({
  client,
  session,
  deriveKek,
  current,
  localItems,
  savePending,
  isCurrent = () => true,
  beforeFlush,
  minGeneration = 0,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  deriveKek: IHardwareCloudSyncKekDeriver;
  current: IHardwareCloudSyncDataKey;
  localItems: T[];
  savePending: (
    next: IHardwareCloudSyncDataKey & { generation: number },
  ) => Promise<void>;
  isCurrent?: () => boolean;
  beforeFlush?: () => Promise<void>;
  minGeneration?: number;
}): Promise<{
  next: IHardwareCloudSyncDataKey;
  items: T[];
  generation: number;
}> {
  const assertCurrent = () => {
    if (!isCurrent()) {
      throw new HardwareCloudSyncCancelledError();
    }
  };
  assertCurrent();
  const existing = await readLockEnvelope({ client, session });
  // Nobody reset it meanwhile. The wallet itself was checked by its identity
  // before the device signs.
  if (!existing || existing.dekId !== current.dekId) {
    throw new HardwareCloudSyncLocalError(
      ETranslations.cloud_sync_key_changed_sync_again__msg,
      'Encryption key changed. Sync again.',
    );
  }
  assertNotRolledBack(existing, minGeneration);
  // The data version the re-encrypted copy is built from. The flush is
  // refused if anything was uploaded after this, instead of dropping it.
  const { nonce: serverNonce } = await requestWithHardwareCloudSyncSession<{
    nonce: number;
  }>({
    client,
    session,
    method: 'POST',
    urlPath: '/prime/v1/sync/check',
    data: { pwdHash: current.pwdHash, nonce: 0, localData: [] },
  });
  if (!Number.isSafeInteger(serverNonce)) {
    throw createHardwareCloudSyncDataError(
      'Cloud sync data version is unavailable',
    );
  }
  // New salt and data key: signatures taken for the old envelope stop working.
  const { dataKey: next, envelope } = await createEnvelope(
    deriveKek,
    existing.generation + 1,
  );
  assertCurrent();
  const items = await reencryptHardwareCloudSyncItems({
    items: localItems,
    from: current,
    to: next,
  });
  // The server copy is the source: it also holds records this device keeps
  // no local copy of, such as other devices' wallets.
  const serverData = await downloadAllForReset({
    client,
    session,
    pwdHash: current.pwdHash,
  });
  const [envelopeRecords, records] = [
    (serverData ?? []).filter((item) =>
      isHardwareCloudSyncKeyEnvelopeItem(item),
    ),
    (serverData ?? []).filter(
      (item) => !isHardwareCloudSyncKeyEnvelopeItem(item),
    ),
  ];
  const serverItems = await reencryptHardwareCloudSyncItems({
    items: records.map((item) => ({
      ...item,
      id: item.key,
      pwdHash: current.pwdHash,
    })),
    from: current,
    to: next,
  });
  const envelopeData = stringUtils.stableStringify(envelope);
  // Keep every earlier envelope; they are tiny and help recovery.
  const envelopeItems = [
    ...envelopeRecords.map(({ key, dataType, data, dataTimestamp }) => ({
      key,
      dataType,
      data,
      dataTimestamp,
      isDeleted: false,
    })),
    {
      key: `dek:${envelope.dekId}`,
      dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
      data: envelopeData,
      dataTimestamp: envelope.createdAt,
      isDeleted: false,
    },
  ];

  logHardwareCloudSyncDiagnostic('rotation_prepared', () => ({
    previousGeneration: existing.generation,
    nextGeneration: envelope.generation,
    localItemCount: localItems.length,
    returnedCount: serverData.length,
    inputEnvelopeCount: envelopeRecords.length,
    outputEnvelopeCount: envelopeItems.length,
    previousCurrentEnvelopeIncluded: envelopeRecords.some(
      (item) => readEnvelope(item.data)?.dekId === existing.dekId,
    ),
  }));
  assertCurrent();
  await savePending({ ...next, generation: envelope.generation });
  assertCurrent();
  await beforeFlush?.();
  assertCurrent();
  await requestWithHardwareCloudSyncSession({
    client,
    session,
    method: 'POST',
    urlPath: '/prime/v1/sync/flush',
    data: {
      nonce: 0,
      pwdHash: next.pwdHash,
      expectedPwdHash: current.pwdHash,
      expectedNonce: serverNonce,
      lock: {
        key: 'lock',
        dataType: 'Lock',
        data: envelopeData,
        dataTimestamp: envelope.createdAt,
      },
      localData: [
        ...serverItems.map(
          ({ key, dataType, data, dataTimestamp, isDeleted }) => ({
            key,
            dataType,
            data: data ?? '',
            dataTimestamp,
            isDeleted: !!isDeleted,
          }),
        ),
        ...envelopeItems,
      ],
    },
  });
  logHardwareCloudSyncDiagnostic('rotation_flush_accepted', {
    generation: envelope.generation,
    outputEnvelopeCount: envelopeItems.length,
  });
  return { next, items, generation: envelope.generation };
}

export type IServerSyncRecord = {
  key: string;
  dataType: string;
  data?: string;
  dataTimestamp?: number;
  isDeleted?: boolean;
};

const RESET_DOWNLOAD_PAGE_SIZE = 1000;
const RESET_DOWNLOAD_MAX_PAGES = 1000;

// Every record, page by page: a partial copy would lose the rest on flush.
export async function downloadAllForReset({
  client,
  session,
  pwdHash,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  pwdHash: string;
}): Promise<IServerSyncRecord[]> {
  const diagnostic = createHardwareCloudSyncDiagnostic();
  const all: IServerSyncRecord[] = [];
  for (let page = 0; page < RESET_DOWNLOAD_MAX_PAGES; page += 1) {
    const { serverData } = await requestWithHardwareCloudSyncSession<{
      serverData: IServerSyncRecord[];
    }>({
      client,
      session,
      method: 'POST',
      urlPath: '/prime/v1/sync/download',
      data: {
        pwdHash,
        includeDeleted: true,
        start: page * RESET_DOWNLOAD_PAGE_SIZE,
        limit: RESET_DOWNLOAD_PAGE_SIZE,
      },
    });
    const items = serverData ?? [];
    all.push(...items);
    diagnostic('reset_download_page', {
      page,
      start: page * RESET_DOWNLOAD_PAGE_SIZE,
      requestedLimit: RESET_DOWNLOAD_PAGE_SIZE,
      returnedCount: items.length,
      totalCount: all.length,
      historyCompleteKnown: false,
    });
    if (items.length < RESET_DOWNLOAD_PAGE_SIZE) {
      diagnostic('reset_download_short_page_completeness_unknown', {
        totalCount: all.length,
        historyCompleteKnown: false,
      });
      return all;
    }
  }
  diagnostic('reset_download_max_pages', { totalCount: all.length });
  throw new HardwareCloudSyncLocalError(
    ETranslations.cloud_sync_key_change_too_much_data__msg,
    'Too much synced data to change the encryption key.',
  );
}

// Stale data version: the server's nonce moved since it was read.
export const HARDWARE_CLOUD_SYNC_NONCE_INVALID_CODE = 90_705;

export function isHardwareCloudSyncNonceInvalidError(error: unknown) {
  return hasErrorCode(error, HARDWARE_CLOUD_SYNC_NONCE_INVALID_CODE);
}
