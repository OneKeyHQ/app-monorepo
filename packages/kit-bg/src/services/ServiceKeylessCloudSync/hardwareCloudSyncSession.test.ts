import { createHash, createPublicKey, verify } from 'crypto';

import {
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  assertHardwareCloudSyncAuthMessage,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import type { IHardwareCloudSyncSession } from '@onekeyhq/shared/types/keylessCloudSync';

import {
  bootstrapHardwareCloudSyncDataKey,
  createHardwareCloudSyncDeviceKey,
  getHardwareCloudSyncDevicePublicJwk,
  requestWithHardwareCloudSyncSession,
} from './hardwareCloudSyncSession';

import type { AxiosInstance } from 'axios';

const BASE_URL = 'http://localhost:7001';
const KEK = 'aa'.repeat(32);

function fakeClient() {
  const get = jest.fn();
  const post = jest.fn();
  const client = { get, post, defaults: { baseURL: BASE_URL } };
  return { client: client as unknown as AxiosInstance, get, post };
}

function session(): IHardwareCloudSyncSession {
  return {
    deviceKeyJwk: createHardwareCloudSyncDeviceKey(),
    accessToken: 'public-test-access',
    accessTokenExpiresAt: Date.now() + 600_000,
    refreshToken: 'public-test-refresh',
    sessionId: 'public-test-session',
    dekId: '',
  };
}

const ok = <T>(data: T) => ({ data: { code: 0, message: 'ok', data } });

describe('hardware Cloud sync session', () => {
  test('DPoP proofs verify as ES256 and bind method, URL and token', async () => {
    const { client, get } = fakeClient();
    const s = session();
    get.mockResolvedValue(ok({ lock: null }));
    await requestWithHardwareCloudSyncSession({
      client,
      session: s,
      method: 'GET',
      urlPath: '/prime/v1/sync/lock',
    });
    const headers = get.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('DPoP public-test-access');
    const [h, p, sig] = headers.DPoP.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(header).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256' });
    expect(header.jwk).toEqual(
      getHardwareCloudSyncDevicePublicJwk(s.deviceKeyJwk),
    );
    expect(header.jwk.d).toBeUndefined();
    expect(payload).toMatchObject({
      htm: 'GET',
      htu: `${BASE_URL}/prime/v1/sync/lock`,
      ath: createHash('sha256')
        .update('public-test-access')
        .digest('base64url'),
    });
    const valid = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      {
        key: createPublicKey({ key: header.jwk, format: 'jwk' }),
        dsaEncoding: 'ieee-p1363',
      },
      Buffer.from(sig, 'base64url'),
    );
    expect(valid).toBe(true);
  });

  test('the first device creates the data key and flushes it wrapped', async () => {
    const { client, get, post } = fakeClient();
    get.mockResolvedValue(ok({ lock: null }));
    post.mockResolvedValue(ok({ nonce: 1, created: 1, updated: 0 }));
    const result = await bootstrapHardwareCloudSyncDataKey({
      client,
      session: session(),
      kek: KEK,
    });
    expect(result.dek).toMatch(/^[0-9a-f]{64}$/);
    const body = post.mock.calls[0][1];
    expect(post.mock.calls[0][0]).toBe('/prime/v1/sync/flush');
    expect(body.expectedPwdHash).toBe('');
    expect(body.pwdHash).toBe(result.pwdHash);
    expect(body.lock.data).toBe(body.localData[0].data);
    expect(body.localData[0].dataType).toBe(
      HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
    );
    // The server only sees the wrapped key.
    expect(JSON.stringify(body)).not.toContain(result.dek);
  });

  test('another device unwraps the same data key from the lock', async () => {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    const created = await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      kek: KEK,
    });
    const lock = first.post.mock.calls[0][1].lock;

    const second = fakeClient();
    second.get.mockResolvedValue(ok({ lock }));
    const joined = await bootstrapHardwareCloudSyncDataKey({
      client: second.client,
      session: session(),
      kek: KEK,
    });
    expect(joined).toEqual(created);
    expect(second.post).not.toHaveBeenCalled();
  });

  test('a device with another KEK cannot unwrap the data key', async () => {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      kek: KEK,
    });
    const other = fakeClient();
    other.get.mockResolvedValue(ok({ lock: first.post.mock.calls[0][1].lock }));
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: other.client,
        session: session(),
        kek: 'bb'.repeat(32),
      }),
    ).rejects.toThrow();
  });

  test('losing a concurrent first enable adopts the winner key', async () => {
    const winner = fakeClient();
    winner.get.mockResolvedValue(ok({ lock: null }));
    winner.post.mockResolvedValue(ok({}));
    const won = await bootstrapHardwareCloudSyncDataKey({
      client: winner.client,
      session: session(),
      kek: KEK,
    });
    const winnerLock = winner.post.mock.calls[0][1].lock;

    const loser = fakeClient();
    loser.get
      .mockResolvedValueOnce(ok({ lock: null }))
      .mockResolvedValueOnce(ok({ lock: winnerLock }));
    loser.post.mockRejectedValueOnce(new Error('PRIME_USER_PWD_HASH_INVALID'));
    const adopted = await bootstrapHardwareCloudSyncDataKey({
      client: loser.client,
      session: session(),
      kek: KEK,
    });
    expect(adopted).toEqual(won);
  });

  test('sign-in challenges must not be the data key message', () => {
    const nonce = 'ab'.repeat(32);
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${nonce}\nDevice: abcd1234`,
      ),
    ).not.toThrow();
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        buildHardwareCloudSyncMessage('0123456789abcdef'),
      ),
    ).toThrow();
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        `OneKey Cloud Sync sign-in\n${buildHardwareCloudSyncMessage(
          '0123456789abcdef',
        )}\nNonce: ${nonce}\n`,
      ),
    ).toThrow();
    expect(() => assertHardwareCloudSyncAuthMessage('Sign anything')).toThrow();
  });
});
