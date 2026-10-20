const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createFixtureStore,
  createRecorder,
  isolatedChromiumArgs,
  readFixtureFile,
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

  test('falls back to the same GET route but never across POST bodies', () => {
    const store = createFixtureStore({
      entries: [
        {
          key: 'GET swap.onekeycn.com/swap/v1/token/detail?contractAddress=a',
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
        url: 'https://swap.onekeycn.com/swap/v1/token/detail?contractAddress=a',
      }),
    ).toMatchObject({ fallback: false, entry: { status: 200 } });
    expect(
      store.lookup({
        method: 'GET',
        url: 'https://swap.onekeycn.com/swap/v1/token/detail?contractAddress=b',
      }),
    ).toMatchObject({ fallback: true, entry: { status: 200 } });
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

  test('recorder skips block pages and merges into the existing file', () => {
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
        key: 'GET a.onekeycn.com/blocked',
        status: 403,
        body: Buffer.from('<html>blocked</html>'),
        scenario: 'root',
      }),
    ).toBe(false);
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
