const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createFixtureStore,
  createRecorder,
  isolatedChromiumArgs,
  readFixtureFile,
  recordRefusal,
  requestKey,
  resolveNetworkMode,
  serializeFixtureFile,
} = require('./webColdNetwork');

function tempFixturePath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'web-cold-network-')),
    'fixtures.json',
  );
}

describe('web cold network fixtures', () => {
  test('keys GET requests by host, path and sorted query without volatile params', () => {
    expect(
      requestKey({
        method: 'get',
        url: 'https://wallet.onekeycn.com/wallet/v1/health?timestamp=1792507483129&_=system_time_utils',
      }),
    ).toBe('GET wallet.onekeycn.com/wallet/v1/health?_=system_time_utils');
    expect(
      requestKey({
        method: 'GET',
        url: 'https://utility.onekeycn.com/utility/v2/market/token/list?page=1&limit=20&networkId=',
      }),
    ).toBe(
      'GET utility.onekeycn.com/utility/v2/market/token/list?limit=20&networkId=&page=1',
    );
  });

  test('percent-encodes query values so delimiters cannot collide', () => {
    const oneParam = requestKey({
      method: 'GET',
      url: 'https://utility.onekeycn.com/a?a=x%26b%3Dy',
    });
    const twoParams = requestKey({
      method: 'GET',
      url: 'https://utility.onekeycn.com/a?a=x&b=y',
    });
    expect(oneParam).toBe('GET utility.onekeycn.com/a?a=x%26b%3Dy');
    expect(twoParams).toBe('GET utility.onekeycn.com/a?a=x&b=y');
  });

  test('keys POST requests by canonical JSON body', () => {
    const key = requestKey({
      method: 'POST',
      url: 'https://api.hyperliquid.xyz/info',
      postData: '{"type":"metaAndAssetCtxs","dex":"xyz"}',
    });
    expect(key).toBe(
      'POST api.hyperliquid.xyz/info {"dex":"xyz","type":"metaAndAssetCtxs"}',
    );
    expect(
      requestKey({
        method: 'POST',
        url: 'https://api.hyperliquid.xyz/info',
        postData: JSON.stringify({ type: 'big', list: 'x'.repeat(300) }),
      }),
    ).toMatch(/^POST api\.hyperliquid\.xyz\/info sha256:[0-9a-f]{16}$/);
  });

  test('only answers exact keys', () => {
    const store = createFixtureStore({
      entries: [
        {
          key: 'GET earn.onekeycn.com/earn/v1/available-assets?type=staking',
          status: 200,
          json: { code: 0 },
        },
        {
          key: 'POST api.hyperliquid.xyz/info {"type":"meta"}',
          status: 200,
          json: [],
        },
      ],
    });

    expect(
      store.lookup({
        method: 'GET',
        url: 'https://earn.onekeycn.com/earn/v1/available-assets?type=staking',
      }).entry,
    ).toMatchObject({ status: 200 });
    expect(
      store.lookup({
        method: 'GET',
        url: 'https://earn.onekeycn.com/earn/v1/available-assets?type=simpleEarn',
      }),
    ).toEqual({
      entry: null,
      key: 'GET earn.onekeycn.com/earn/v1/available-assets?type=simpleEarn',
    });
    expect(
      store.lookup({
        method: 'POST',
        url: 'https://api.hyperliquid.xyz/info',
        postData: '{"type":"allMids"}',
      }).entry,
    ).toBeNull();
    expect(
      store.lookup({
        method: 'GET',
        url: 'https://utility.onekeycn.com/utility/v1/track/event',
      }).entry,
    ).toBeNull();
  });

  test('recorder merges into the existing file', () => {
    const fixturePath = tempFixturePath();
    const log = jest.fn();
    const first = createRecorder({
      fixturePath,
      source: 'test',
      fresh: true,
      log,
    });
    expect(
      first.add({
        key: 'GET a.onekeycn.com/a',
        status: 200,
        body: Buffer.from('{"code":0}'),
        scenario: 'root',
      }),
    ).toBe(true);
    expect(
      first.add({
        key: 'GET a.onekeycn.com/empty',
        status: 204,
        body: Buffer.alloc(0),
        scenario: 'swap',
      }),
    ).toBe(true);
    first.write();

    const second = createRecorder({
      fixturePath,
      source: 'test',
      fresh: false,
      log,
    });
    second.add({
      key: 'GET a.onekeycn.com/a',
      status: 200,
      body: Buffer.from('{"code":1}'),
      scenario: 'market',
    });
    second.write();

    const file = readFixtureFile(fixturePath);
    expect(file.source).toBe('test');
    expect(file.entries).toEqual([
      expect.objectContaining({
        key: 'GET a.onekeycn.com/a',
        json: { code: 1 },
        scenarios: ['market', 'root'],
      }),
      expect.objectContaining({
        key: 'GET a.onekeycn.com/empty',
        status: 204,
        text: '',
      }),
    ]);
  });

  test('recorder refuses to write after a call was not recorded', () => {
    const fixturePath = tempFixturePath();
    fs.writeFileSync(fixturePath, '{"entries":[]}\n');
    const recorder = createRecorder({
      fixturePath,
      source: 'test',
      fresh: true,
      log: jest.fn(),
    });
    recorder.add({
      key: 'GET a.onekeycn.com/a',
      status: 200,
      body: Buffer.from('{"code":0}'),
      scenario: 'root',
    });
    expect(
      recorder.add({
        key: 'GET a.onekeycn.com/blocked',
        status: 403,
        body: Buffer.from('<html>blocked</html>'),
        scenario: 'root',
      }),
    ).toBe(false);
    recorder.fail('GET a.onekeycn.com/moved', 'fetch failed: redirect');

    expect(recorder.failures()).toEqual([
      {
        key: 'GET a.onekeycn.com/blocked',
        reason: 'upstream answered 403 without JSON',
      },
      { key: 'GET a.onekeycn.com/moved', reason: 'fetch failed: redirect' },
    ]);
    expect(() => recorder.write()).toThrow(/refusing to write/);
    expect(fs.readFileSync(fixturePath, 'utf8')).toBe('{"entries":[]}\n');
  });

  test('records only reviewed public endpoints without credentials', () => {
    const publicKey =
      'GET utility.onekeycn.com/utility/v2/market/token/list?limit=20&page=1';
    expect(recordRefusal({ key: publicKey, headers: {} })).toBeNull();
    expect(
      recordRefusal({
        key: 'POST api.hyperliquid.xyz/info {"dex":"xyz","type":"metaAndAssetCtxs"}',
        headers: {},
      }),
    ).toBeNull();
    expect(
      recordRefusal({ key: publicKey, headers: { authorization: 'Bearer x' } }),
    ).toBe('carries authorization');
    expect(
      recordRefusal({
        key: publicKey,
        headers: { 'x-onekey-request-token': 'token' },
      }),
    ).toBe('carries x-onekey-request-token');
    for (const key of [
      'GET wallet.onekeycn.com/wallet/v1/account/list?address=0x1',
      'POST earn.onekeycn.com/earn/v2/recommend {"accounts":[{"accountAddress":"0x1"}]}',
      'POST api.hyperliquid.xyz/info {"type":"clearinghouseState","user":"0x1"}',
    ]) {
      expect(recordRefusal({ key, headers: {} })).toBe(
        'endpoint not in RECORDABLE_ENDPOINTS',
      );
    }
  });

  test('serializes one sorted entry per line', () => {
    const text = serializeFixtureFile({
      source: 'test',
      entries: [
        { key: 'GET b/b', json: { b: 1 } },
        { key: 'GET a/a', json: { a: 1 } },
      ],
    });
    const lines = text.split('\n');
    expect(lines).toContain('    {"key":"GET a/a","json":{"a":1}},');
    expect(lines).toContain('    {"key":"GET b/b","json":{"b":1}}');
    expect(lines.indexOf('    {"key":"GET a/a","json":{"a":1}},')).toBeLessThan(
      lines.indexOf('    {"key":"GET b/b","json":{"b":1}}'),
    );
    expect(JSON.parse(text).entries).toHaveLength(2);
  });

  test('isolates Chromium from real hosts unless live', () => {
    expect(resolveNetworkMode(undefined)).toBe('fixtures');
    expect(() => resolveNetworkMode('offline')).toThrow(
      /PERF_WEB_COLD_NETWORK/,
    );
    expect(isolatedChromiumArgs('live')).toEqual([]);
    expect(isolatedChromiumArgs('fixtures')).toContain(
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    );
  });
});
