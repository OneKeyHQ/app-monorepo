import { createHash, createPublicKey, verify } from 'crypto';

import {
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  assertHardwareCloudSyncAuthMessage,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IHardwareCloudSyncSession } from '@onekeyhq/shared/types/keylessCloudSync';

import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  assertHardwareCloudSyncChallengeFor,
  bootstrapHardwareCloudSyncDataKey,
  computeHardwareCloudSyncPwdHash,
  createHardwareCloudSyncDeviceKey,
  getHardwareCloudSyncDeviceKeyThumbprint,
  getHardwareCloudSyncDevicePublicJwk,
  reencryptHardwareCloudSyncItems,
  requestHardwareCloudSyncChallenge,
  requestWithHardwareCloudSyncSession,
  rotateHardwareCloudSyncDataKey,
} from './hardwareCloudSyncSession';

import type { AxiosInstance } from 'axios';

const BASE_URL = 'http://localhost:7001';

// Stands in for a wallet: a KEK that depends on its secret and the salt.
function wallet(secret: string) {
  return jest.fn(async (kekSalt: string) =>
    createHash('sha256').update(`${secret}:${kekSalt}`).digest('hex'),
  );
}
const WALLET = 'wallet-a';

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

const MINUTE = 60 * 1000;

// Server minus local clock: what the app estimates now, and what measuring
// the server clock again finds.
let estimatedClockOffsetMs = 0;
let measuredClockOffsetMs = 0;
let refreshServerTime: jest.SpyInstance;

const proofIatMs = (config: { headers: Record<string, string> }) =>
  (
    JSON.parse(
      Buffer.from(config.headers.DPoP.split('.')[1], 'base64url').toString(),
    ) as { iat: number }
  ).iat * 1000;

const unauthorized = () =>
  Object.assign(new Error('Unauthorized'), { response: { status: 401 } });

describe('hardware Cloud sync session', () => {
  beforeEach(() => {
    estimatedClockOffsetMs = 0;
    measuredClockOffsetMs = 0;
    jest
      .spyOn(systemTimeUtils, 'getEstimatedServerTime')
      .mockImplementation(() => Date.now() + estimatedClockOffsetMs);
    jest
      .spyOn(systemTimeUtils, 'ensureFreshServerTime')
      .mockResolvedValue(true);
    refreshServerTime = jest
      .spyOn(systemTimeUtils, 'refreshServerTime')
      .mockImplementation(async () => {
        estimatedClockOffsetMs = measuredClockOffsetMs;
        return true;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('server clock', () => {
    test('DPoP proofs carry the server time when the local clock is off', async () => {
      estimatedClockOffsetMs = -120 * MINUTE;
      const { client, get } = fakeClient();
      get.mockResolvedValue(ok({ lock: null }));
      await requestWithHardwareCloudSyncSession({
        client,
        session: session(),
        method: 'GET',
        urlPath: '/prime/v1/sync/lock',
      });
      const iat = proofIatMs(get.mock.calls[0][1]);
      expect(Math.abs(iat - (Date.now() - 120 * MINUTE))).toBeLessThan(5000);
    });

    test('a proof refused for a stale clock is resent once with a new proof', async () => {
      // The estimate predates a sleep; the server is 10 minutes further on.
      measuredClockOffsetMs = 10 * MINUTE;
      const { client, post } = fakeClient();
      post
        .mockRejectedValueOnce(unauthorized())
        .mockResolvedValueOnce(ok({ nonce: 3 }));
      await expect(
        requestWithHardwareCloudSyncSession({
          client,
          session: session(),
          method: 'POST',
          urlPath: '/prime/v1/sync/check',
          data: {},
        }),
      ).resolves.toEqual({ nonce: 3 });
      expect(post).toHaveBeenCalledTimes(2);
      const [first, second] = post.mock.calls.map(
        (call) => call[2] as { headers: Record<string, string> },
      );
      expect(proofIatMs(second) - proofIatMs(first)).toBeGreaterThan(
        9 * MINUTE,
      );
      expect(second.headers.DPoP).not.toBe(first.headers.DPoP);
    });

    test('a refusal the clock does not explain is not resent', async () => {
      const { client, post } = fakeClient();
      post.mockRejectedValue(unauthorized());
      await expect(
        requestWithHardwareCloudSyncSession({
          client,
          session: session(),
          method: 'POST',
          urlPath: '/prime/v1/sync/check',
          data: {},
        }),
      ).rejects.toMatchObject({ response: { status: 401 } });
      expect(post).toHaveBeenCalledTimes(1);
      expect(refreshServerTime).toHaveBeenCalledTimes(1);
    });

    test('sign-in checks the challenge against a fresh server clock', async () => {
      // The local clock runs 10 minutes ahead and nothing measured it yet.
      measuredClockOffsetMs = -10 * MINUTE;
      const jwk = createHardwareCloudSyncDeviceKey();
      const expires = new Date(Date.now() - 10 * MINUTE + 2 * MINUTE);
      const message = `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${'ab'.repeat(
        32,
      )}\nDevice: ${getHardwareCloudSyncDeviceKeyThumbprint(jwk).slice(
        0,
        8,
      )}\nExpires: ${expires.toISOString()}`;
      const { client, post } = fakeClient();
      post.mockResolvedValue(
        ok({ challengeId: 'public-test-challenge', message }),
      );
      await expect(
        requestHardwareCloudSyncChallenge({ client, jwk }),
      ).resolves.toMatchObject({ challengeId: 'public-test-challenge' });
      expect(refreshServerTime).toHaveBeenCalledTimes(1);
    });
  });

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
      deriveKek: wallet(WALLET),
    });
    expect(result.dek).toMatch(/^[0-9a-f]{64}$/);
    expect(result.pwdHash).toMatch(/^hw-dek-[0-9a-f]{64}$/);
    expect(result.pwdHash).toBe(computeHardwareCloudSyncPwdHash(result.dekId));
    const body = post.mock.calls[0][1];
    const envelope = JSON.parse(body.lock.data);
    expect(envelope).toMatchObject({ dekId: result.dekId, kekVersion: 1 });
    expect(envelope.kekSalt).toMatch(/^[0-9a-f]{32}$/);
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
      deriveKek: wallet(WALLET),
    });
    const lock = first.post.mock.calls[0][1].lock;

    const second = fakeClient();
    second.get.mockResolvedValue(ok({ lock }));
    second.post.mockResolvedValue(ok({ serverData: [] }));
    const deriveKek = wallet(WALLET);
    const joined = await bootstrapHardwareCloudSyncDataKey({
      client: second.client,
      session: session(),
      deriveKek,
    });
    expect(joined).toEqual(created);
    // Signs the salt found in the Lock, once.
    expect(deriveKek.mock.calls).toEqual([[JSON.parse(lock.data).kekSalt]]);
    // Only reads earlier envelopes; never flushes.
    expect(second.post.mock.calls.map((call) => call[0] as string)).toEqual([
      '/prime/v1/sync/download',
    ]);
  });

  test('a device with another KEK cannot unwrap the data key', async () => {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      deriveKek: wallet(WALLET),
    });
    const other = fakeClient();
    other.get.mockResolvedValue(ok({ lock: first.post.mock.calls[0][1].lock }));
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: other.client,
        session: session(),
        deriveKek: wallet('wallet-b'),
      }),
    ).rejects.toThrow();
  });

  test('a wrapped key does not unwrap under another key id', async () => {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      deriveKek: wallet(WALLET),
    });
    const lock = first.post.mock.calls[0][1].lock;
    const swapped = {
      ...lock,
      data: JSON.stringify({
        ...JSON.parse(lock.data),
        dekId: 'ee'.repeat(16),
      }),
    };
    const c = fakeClient();
    c.get.mockResolvedValue(ok({ lock: swapped }));
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek: wallet(WALLET),
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
      deriveKek: wallet(WALLET),
    });
    const winnerLock = winner.post.mock.calls[0][1].lock;

    const loser = fakeClient();
    loser.get
      .mockResolvedValueOnce(ok({ lock: null }))
      .mockResolvedValueOnce(ok({ lock: winnerLock }));
    loser.post
      .mockRejectedValueOnce(
        Object.assign(new Error('pwdHash invalid'), { code: 90_010 }),
      )
      .mockResolvedValueOnce(ok({ serverData: [] }));
    const adopted = await bootstrapHardwareCloudSyncDataKey({
      client: loser.client,
      session: session(),
      deriveKek: wallet(WALLET),
    });
    expect(adopted).toEqual(won);
  });

  test('sign-in challenges must not be the data key message', () => {
    const nonce = 'ab'.repeat(32);
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${nonce}\nDevice: abcd1234\nExpires: 2030-01-01T00:00:00.000Z`,
      ),
    ).not.toThrow();
    // Extra server-chosen text is never shown on the device.
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${nonce}\nDevice: abcd1234\nExpires: 2030-01-01T00:00:00.000Z\nSend 1 BTC to approve`,
      ),
    ).toThrow();
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        buildHardwareCloudSyncMessage(
          '0123456789abcdef',
          '0123456789abcdef0123456789abcdef',
        ),
      ),
    ).toThrow();
    expect(() =>
      assertHardwareCloudSyncAuthMessage(
        `OneKey Cloud Sync sign-in\n${buildHardwareCloudSyncMessage(
          '0123456789abcdef',
          '0123456789abcdef0123456789abcdef',
        )}\nNonce: ${nonce}\n`,
      ),
    ).toThrow();
    expect(() => assertHardwareCloudSyncAuthMessage('Sign anything')).toThrow();
  });

  test.each([
    [
      'missing salt',
      (e: Record<string, unknown>) => ({ ...e, kekSalt: undefined }),
    ],
    [
      'uppercase salt',
      (e: Record<string, unknown>) => ({ ...e, kekSalt: 'AB'.repeat(16) }),
    ],
    [
      'text in salt',
      (e: Record<string, unknown>) => ({
        ...e,
        kekSalt: 'Sign this to send funds now!!!!!',
      }),
    ],
    ['kekVersion 2', (e: Record<string, unknown>) => ({ ...e, kekVersion: 2 })],
    [
      'no generation',
      (e: Record<string, unknown>) => ({ ...e, generation: undefined }),
    ],
  ])('refuses to sign for a Lock with %s', async (_name, mutate) => {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      deriveKek: wallet(WALLET),
    });
    const lock = first.post.mock.calls[0][1].lock;
    const bad = {
      ...lock,
      data: JSON.stringify(mutate(JSON.parse(lock.data))),
    };
    const c = fakeClient();
    c.get.mockResolvedValue(ok({ lock: bad }));
    const deriveKek = wallet(WALLET);
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek,
      }),
    ).rejects.toThrow('Invalid Cloud sync key envelope');
    expect(deriveKek).not.toHaveBeenCalled();
    expect(c.post).not.toHaveBeenCalled();
  });

  async function createdLock() {
    const first = fakeClient();
    first.get.mockResolvedValue(ok({ lock: null }));
    first.post.mockResolvedValue(ok({}));
    await bootstrapHardwareCloudSyncDataKey({
      client: first.client,
      session: session(),
      deriveKek: wallet(WALLET),
    });
    return first.post.mock.calls[0][1].lock as { data: string };
  }

  test('refuses a Lock older than a key generation already seen', async () => {
    const lock = await createdLock();
    expect(JSON.parse(lock.data).generation).toBe(1);
    const c = fakeClient();
    c.get.mockResolvedValue(ok({ lock }));
    const deriveKek = wallet(WALLET);
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek,
        minGeneration: 2,
      }),
    ).rejects.toThrow('older than this device has seen');
    expect(deriveKek).not.toHaveBeenCalled();
  });

  test('a relabelled generation does not unwrap', async () => {
    const lock = await createdLock();
    const relabelled = {
      ...lock,
      data: JSON.stringify({ ...JSON.parse(lock.data), generation: 9 }),
    };
    const c = fakeClient();
    c.get.mockResolvedValue(ok({ lock: relabelled }));
    await expect(
      bootstrapHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek: wallet(WALLET),
      }),
    ).rejects.toThrow();
  });

  test('signs only a fresh challenge for this request device key', () => {
    const jwk = createHardwareCloudSyncDeviceKey();
    const tag = getHardwareCloudSyncDeviceKeyThumbprint(jwk).slice(0, 8);
    const now = Date.parse('2030-01-01T00:00:00.000Z');
    const message = (device: string, expires: string) =>
      `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${'ab'.repeat(32)}\nDevice: ${device}\nExpires: ${expires}`;
    expect(() =>
      assertHardwareCloudSyncChallengeFor({
        message: message(tag, '2030-01-01T00:05:00.000Z'),
        jwk,
        now,
      }),
    ).not.toThrow();
    for (const [device, expires] of [
      ['zzzzzzzz', '2030-01-01T00:05:00.000Z'],
      [tag, '2029-12-31T23:59:59.000Z'],
      [tag, '2030-01-02T00:00:00.000Z'],
    ]) {
      expect(() =>
        assertHardwareCloudSyncChallengeFor({
          message: message(device, expires),
          jwk,
          now,
        }),
      ).toThrow('Invalid Cloud sync sign-in challenge');
    }
  });

  describe('data key reset', () => {
    async function firstDevice() {
      const c = fakeClient();
      c.get.mockResolvedValue(ok({ lock: null }));
      c.post.mockResolvedValue(ok({}));
      const key = await bootstrapHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek: wallet(WALLET),
      });
      const flushed = c.post.mock.calls[0][1];
      return { key, lock: flushed.lock, envelopeItem: flushed.localData[0] };
    }

    async function item(dek: string, pwdHash: string, id: string) {
      return {
        id,
        dataType: 'BrowserBookmark',
        pwdHash,
        data: await keylessCloudSyncUtils.encryptWithKeylessKey({
          rawData: `raw-${id}`,
          encryptionKey: dek,
          itemId: id,
          dataType: 'BrowserBookmark',
        }),
      };
    }

    test('re-encrypts records with the new key in one guarded flush', async () => {
      const { key, lock, envelopeItem } = await firstDevice();
      const local = [
        await item(key.dek, key.pwdHash, 'a'),
        { ...(await item(key.dek, 'keyless-other', 'b')) },
      ];
      // The server also holds a record this device has no local copy of.
      const remote = await item(key.dek, key.pwdHash, 'from-other-device');
      const serverData = [
        envelopeItem,
        { key: 'a', dataType: 'BrowserBookmark', data: local[0].data },
        { key: remote.id, dataType: remote.dataType, data: remote.data },
        { key: 'gone', dataType: 'BrowserBookmark', data: '', isDeleted: true },
      ];
      const c = fakeClient();
      c.get.mockResolvedValue(ok({ lock }));
      c.post
        .mockResolvedValueOnce(ok({ nonce: 7 }))
        .mockResolvedValueOnce(ok({ serverData }))
        .mockResolvedValueOnce(ok({}));
      const savePending = jest.fn(async () => undefined);
      const { next, items } = await rotateHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek: wallet(WALLET),
        current: key,
        localItems: local,
        savePending,
      });
      expect(next.dek).not.toBe(key.dek);
      expect(next.pwdHash).toBe(computeHardwareCloudSyncPwdHash(next.dekId));
      const newSalt = JSON.parse(c.post.mock.calls[2][1].lock.data).kekSalt;
      expect(newSalt).toMatch(/^[0-9a-f]{32}$/);
      expect(newSalt).not.toBe(JSON.parse(lock.data).kekSalt);
      expect(savePending).toHaveBeenCalledWith({ ...next, generation: 2 });
      // Only records under the current key are carried over.
      expect(items.map((i) => i.id)).toEqual(['a']);
      await expect(
        keylessCloudSyncUtils.decryptWithKeylessKey({
          encryptedData: items[0].data,
          encryptionKey: next.dek,
          itemId: 'a',
          dataType: 'BrowserBookmark',
        }),
      ).resolves.toBe('raw-a');

      const flush = c.post.mock.calls[2] as [
        string,
        {
          localData: Array<{
            key: string;
            dataType: string;
            data: string;
            isDeleted: boolean;
          }>;
        },
      ];
      expect(flush[0]).toBe('/prime/v1/sync/flush');
      expect(flush[1]).toMatchObject({
        pwdHash: next.pwdHash,
        expectedPwdHash: key.pwdHash,
        // Refused if anything was uploaded after the copy was read.
        expectedNonce: 7,
      });
      expect(JSON.parse(c.post.mock.calls[2][1].lock.data).generation).toBe(2);
      const types = flush[1].localData.map(
        (i: { dataType: string }) => i.dataType,
      );
      expect(
        types.filter(
          (t: string) => t === HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
        ),
      ).toHaveLength(2);
      expect(JSON.stringify(flush[1])).not.toContain(next.dek);
      // Server records, including other devices' and deletions, carry over.
      const byKey = Object.fromEntries(
        flush[1].localData.map((i) => [i.key, i]),
      );
      expect(Object.keys(byKey)).toEqual(
        expect.arrayContaining(['a', 'from-other-device', 'gone']),
      );
      expect(byKey.gone.isDeleted).toBe(true);
      await expect(
        keylessCloudSyncUtils.decryptWithKeylessKey({
          encryptedData: byKey['from-other-device'].data,
          encryptionKey: next.dek,
          itemId: 'from-other-device',
          dataType: 'BrowserBookmark',
        }),
      ).resolves.toBe('raw-from-other-device');
    });

    test('reads every page of server records before resetting', async () => {
      const { key, lock } = await firstDevice();
      const deleted = (n: number, from: number) =>
        Array.from({ length: n }, (_, i) => ({
          key: `k${from + i}`,
          dataType: 'BrowserBookmark',
          data: '',
          isDeleted: true,
        }));
      const c = fakeClient();
      c.get.mockResolvedValue(ok({ lock }));
      c.post
        .mockResolvedValueOnce(ok({ nonce: 3 }))
        .mockResolvedValueOnce(ok({ serverData: deleted(1000, 0) }))
        .mockResolvedValueOnce(ok({ serverData: deleted(2, 1000) }))
        .mockResolvedValueOnce(ok({}));
      await rotateHardwareCloudSyncDataKey({
        client: c.client,
        session: session(),
        deriveKek: wallet(WALLET),
        current: key,
        localItems: [],
        savePending: jest.fn(async () => undefined),
      });
      expect(c.post.mock.calls[1][1]).toMatchObject({ skip: 0, limit: 1000 });
      expect(c.post.mock.calls[2][1]).toMatchObject({
        skip: 1000,
        limit: 1000,
      });
      const flushed = c.post.mock.calls[3][1].localData as unknown[];
      // 1002 records plus the new envelope.
      expect(flushed).toHaveLength(1003);
    });

    test('refuses when the server key was already reset', async () => {
      const { key, lock } = await firstDevice();
      const c = fakeClient();
      c.get.mockResolvedValue(ok({ lock }));
      await expect(
        rotateHardwareCloudSyncDataKey({
          client: c.client,
          session: session(),
          deriveKek: wallet(WALLET),
          current: { ...key, dekId: 'ee'.repeat(16) },
          localItems: [],
          savePending: jest.fn(),
        }),
      ).rejects.toThrow('Cloud sync key changed');
      expect(c.post).not.toHaveBeenCalled();
    });

    test('a joining device learns earlier key versions by id', async () => {
      const { key, envelopeItem } = await firstDevice();
      const other = await (async () => {
        const c = fakeClient();
        c.get.mockResolvedValue(ok({ lock: null }));
        c.post.mockResolvedValue(ok({}));
        await bootstrapHardwareCloudSyncDataKey({
          client: c.client,
          session: session(),
          deriveKek: wallet('wallet-c'),
        });
        const flushed = c.post.mock.calls[0][1] as {
          localData: Record<string, unknown>[];
        };
        return flushed.localData[0];
      })();
      const rotated = fakeClient();
      rotated.get.mockResolvedValue(ok({ lock: null }));
      rotated.post.mockResolvedValue(ok({}));
      const newer = await bootstrapHardwareCloudSyncDataKey({
        client: rotated.client,
        session: session(),
        deriveKek: wallet(WALLET),
      });
      const joiner = fakeClient();
      joiner.get.mockResolvedValue(
        ok({ lock: rotated.post.mock.calls[0][1].lock }),
      );
      joiner.post.mockResolvedValue(
        ok({
          serverData: [
            envelopeItem,
            other,
            { ...other, data: '{"dekId":"legacy"}' },
          ],
        }),
      );
      const joined = await bootstrapHardwareCloudSyncDataKey({
        client: joiner.client,
        session: session(),
        deriveKek: wallet(WALLET),
      });
      expect(joined.dek).toBe(newer.dek);
      expect(joined.previousPwdHashes.toSorted()).toEqual(
        [
          key.pwdHash,
          computeHardwareCloudSyncPwdHash(
            JSON.parse(other.data as string).dekId,
          ),
        ].toSorted(),
      );
    });

    test('re-encryption drops records written with another key', async () => {
      const { key } = await firstDevice();
      const to = { dek: 'dd'.repeat(32), dekId: 'x', pwdHash: 'keyless-next' };
      const out = await reencryptHardwareCloudSyncItems({
        items: [
          { id: 'gone', dataType: 'Wallet', pwdHash: 'keyless-old' },
          { id: 'deleted', dataType: 'Wallet', pwdHash: key.pwdHash },
        ],
        from: key,
        to,
      });
      expect(out).toEqual([
        {
          id: 'deleted',
          dataType: 'Wallet',
          pwdHash: 'keyless-next',
          data: undefined,
        },
      ]);
    });
  });
});
