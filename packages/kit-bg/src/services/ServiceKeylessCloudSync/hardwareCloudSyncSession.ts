import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';

import { HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  IHardwareCloudSyncDeviceKeyJwk,
  IHardwareCloudSyncSession,
} from '@onekeyhq/shared/types/keylessCloudSync';

import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const AUTH_BASE = '/prime/v1/hw-sync/auth';
const ENVELOPE_ITEM_ID = 'hardware-cloud-dek';
// Refresh a little early so a request never races the expiry.
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

type ITokenResponse = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  sessionId: string;
};

type IKeyEnvelope = {
  dekId: string;
  kekVersion: 1;
  wrappedDek: string;
  createdAt: number;
};

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

function buildPossessionProof({
  jwk,
  htm,
  htu,
  accessToken,
}: {
  jwk: IHardwareCloudSyncDeviceKeyJwk;
  htm: string;
  htu: string;
  accessToken?: string;
}): string {
  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: getHardwareCloudSyncDevicePublicJwk(jwk),
  };
  const payload: Record<string, unknown> = {
    htm,
    htu,
    iat: Math.floor(Date.now() / 1000),
    jti: randomHex(32),
  };
  if (accessToken) {
    payload.ath = toBase64url(sha256(Buffer.from(accessToken, 'utf8')));
  }
  const input = `${toBase64url(JSON.stringify(header))}.${toBase64url(
    JSON.stringify(payload),
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
  const headers: Record<string, string> = {
    DPoP: buildPossessionProof({
      jwk,
      htm: method,
      htu: getHtu(client, urlPath),
      accessToken,
    }),
  };
  if (accessToken) {
    headers.Authorization = `DPoP ${accessToken}`;
  }
  const config: AxiosRequestConfig = { headers };
  return method === 'GET'
    ? client.get<IApiClientResponse<T>>(urlPath, config)
    : client.post<IApiClientResponse<T>>(urlPath, data, config);
}

function toSession(
  tokens: ITokenResponse,
  jwk: IHardwareCloudSyncDeviceKeyJwk,
  dekId: string,
): IHardwareCloudSyncSession {
  return {
    deviceKeyJwk: jwk,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    dekId,
  };
}

export async function requestHardwareCloudSyncChallenge({
  client,
  jwk,
}: {
  client: AxiosInstance;
  jwk: IHardwareCloudSyncDeviceKeyJwk;
}) {
  // The server recovers the identity key from the signature.
  const response = await client.post<
    IApiClientResponse<{ challengeId: string; message: string }>
  >(`${AUTH_BASE}/challenge`, {
    deviceKeyJwk: getHardwareCloudSyncDevicePublicJwk(jwk),
  });
  return response.data.data;
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

async function wrapDek({ kek, dek }: { kek: string; dek: string }) {
  return keylessCloudSyncUtils.encryptWithKeylessKey({
    rawData: dek,
    encryptionKey: kek,
    itemId: ENVELOPE_ITEM_ID,
    dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  });
}

async function unwrapDek({
  kek,
  wrappedDek,
}: {
  kek: string;
  wrappedDek: string;
}) {
  const dek = await keylessCloudSyncUtils.decryptWithKeylessKey({
    encryptedData: wrappedDek,
    encryptionKey: kek,
    itemId: ENVELOPE_ITEM_ID,
    dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  });
  if (!/^[0-9a-f]{64}$/.test(dek)) {
    throw new OneKeyLocalError('Invalid Cloud sync data key');
  }
  return dek;
}

function parseEnvelope(data: string | undefined): IKeyEnvelope | undefined {
  if (!data) return undefined;
  const envelope = JSON.parse(data) as IKeyEnvelope;
  if (!envelope?.dekId || !envelope.wrappedDek) {
    throw new OneKeyLocalError('Invalid Cloud sync key envelope');
  }
  return envelope;
}

/**
 * Returns the data key for this hardware identity. The first device creates it
 * and stores it wrapped by the device-derived KEK; later devices unwrap it.
 * The server only ever sees the wrapped form.
 */
export async function bootstrapHardwareCloudSyncDataKey({
  client,
  session,
  kek,
}: {
  client: AxiosInstance;
  session: IHardwareCloudSyncSession;
  kek: string;
}): Promise<{ dek: string; dekId: string; pwdHash: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { lock } = await requestWithHardwareCloudSyncSession<{
      lock: { data?: string } | null;
    }>({ client, session, method: 'GET', urlPath: '/prime/v1/sync/lock' });
    const existing = parseEnvelope(lock?.data);
    if (existing) {
      const dek = await unwrapDek({ kek, wrappedDek: existing.wrappedDek });
      return {
        dek,
        dekId: existing.dekId,
        pwdHash: keylessCloudSyncUtils.computeKeylessPwdHash(dek),
      };
    }

    const dek = bufferUtils.bytesToHex(p256.utils.randomPrivateKey());
    const envelope: IKeyEnvelope = {
      dekId: randomHex(32),
      kekVersion: 1,
      wrappedDek: await wrapDek({ kek, dek }),
      createdAt: Date.now(),
    };
    const pwdHash = keylessCloudSyncUtils.computeKeylessPwdHash(dek);
    const envelopeData = JSON.stringify(envelope);
    try {
      await requestWithHardwareCloudSyncSession({
        client,
        session,
        method: 'POST',
        urlPath: '/prime/v1/sync/flush',
        data: {
          nonce: 0,
          pwdHash,
          // Only the first device may create the key; a concurrent first
          // enable loses here and unwraps the winner's key instead.
          expectedPwdHash: '',
          lock: {
            key: 'lock',
            dataType: 'Lock',
            data: envelopeData,
            dataTimestamp: envelope.createdAt,
          },
          localData: [
            {
              key: `dek:${envelope.dekId}`,
              dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
              data: envelopeData,
              dataTimestamp: envelope.createdAt,
              isDeleted: false,
            },
          ],
        },
      });
      return { dek, dekId: envelope.dekId, pwdHash };
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new OneKeyLocalError('Cloud sync data key is unavailable');
}
