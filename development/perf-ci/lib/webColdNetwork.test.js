const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createFixtureStore,
  createRecorder,
  isolatedChromiumArgs,
  readFixtureFile,
  recordRefusal,
  redactRequest,
  redactUrl,
  requestKey,
  resolveNetworkMode,
  serializeFixtureFile,
  writeFileAtomic,
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
      label: 'GET a.onekeycn.com/a',
      status: 200,
      body: Buffer.from('{"code":0}'),
      scenario: 'root',
    });
    const rejected = [
      [403, '<html>blocked</html>', 'upstream answered 403'],
      [302, '', 'upstream answered 302'],
      [301, '{"moved":true}', 'upstream answered 301'],
      [200, '', 'upstream answered 200 with an empty body'],
      [200, 'ok', 'upstream answered 200 without JSON'],
    ];
    for (const [status, text, reason] of rejected) {
      expect(
        recorder.add({
          key: `GET a.onekeycn.com/${status}-${text}`,
          label: `GET a.onekeycn.com/${status}-${text.length}`,
          status,
          body: Buffer.from(text),
          scenario: 'root',
        }),
      ).toBe(false);
      expect(recorder.failures()).toContainEqual({
        request: `GET a.onekeycn.com/${status}-${text.length}`,
        reason,
      });
    }
    recorder.fail('GET a.onekeycn.com/b?token', 'fetch failed: timeout');
    expect(recorder.failures()).toHaveLength(rejected.length + 1);

    expect(() => recorder.write()).toThrow(/refusing to write/);
    expect(fs.readFileSync(fixturePath, 'utf8')).toBe('{"entries":[]}\n');
  });

  test('records only reviewed public endpoints and parameters without credentials', () => {
    const publicRequest = {
      method: 'GET',
      url: 'https://utility.onekeycn.com/utility/v2/market/token/list?limit=20&page=1',
    };
    expect(recordRefusal({ ...publicRequest, headers: {} })).toBeNull();
    expect(
      recordRefusal({
        method: 'GET',
        url: 'https://wallet.onekeycn.com/wallet/v1/health?_=system_time_utils&timestamp=1',
        headers: {},
      }),
    ).toBeNull();
    expect(
      recordRefusal({
        method: 'GET',
        url: 'https://utility.onekeycn.com/utility/v2/market/banner/token-list/6aaa5bf8185583c1679c37dc?currency=usd',
        headers: {},
      }),
    ).toBeNull();
    expect(
      recordRefusal({
        method: 'POST',
        url: 'https://api.hyperliquid.xyz/info',
        postData: '{"type":"metaAndAssetCtxs","dex":"xyz"}',
        headers: {},
      }),
    ).toBeNull();

    for (const header of [
      'authorization',
      'cookie',
      'x-onekey-request-token',
    ]) {
      expect(
        recordRefusal({ ...publicRequest, headers: { [header]: 'secret' } }),
      ).toBe(`carries ${header}`);
    }
    expect(
      recordRefusal({
        method: 'GET',
        url: 'https://wallet.onekeycn.com/wallet/v1/network/list?onlyEvmNetworks=true&accountAddress=0x1',
        headers: {},
      }),
    ).toBe('query parameter "accountAddress" not allowed for this endpoint');
    expect(
      recordRefusal({
        method: 'GET',
        url: 'https://wallet.onekeycn.com/wallet/v1/account/list?address=0x1',
        headers: {},
      }),
    ).toBe('endpoint not in RECORDABLE_ENDPOINTS');
    for (const postData of [
      '{"accounts":[{"accountAddress":"0x1"}]}',
      '{"type":"clearinghouseState","user":"0x1"}',
    ]) {
      const url = postData.includes('accounts')
        ? 'https://earn.onekeycn.com/earn/v2/recommend'
        : 'https://api.hyperliquid.xyz/info';
      expect(
        recordRefusal({ method: 'POST', url, postData, headers: {} }),
      ).toBe('request body not allowed for this endpoint');
    }
  });

  test('redacts query values and bodies for logs', () => {
    expect(
      redactUrl(
        'https://wallet.onekeycn.com/wallet/v1/x?address=0xabc&b=1&address=0xdef',
      ),
    ).toBe('https://wallet.onekeycn.com/wallet/v1/x?address&b');
    const label = redactRequest({
      method: 'POST',
      url: 'https://earn.onekeycn.com/earn/v2/recommend?wallet=w1',
      postData: '{"accounts":["0xabc"]}',
    });
    expect(label).toMatch(
      /^POST earn\.onekeycn\.com\/earn\/v2\/recommend\?wallet body sha256:[0-9a-f]{16}$/,
    );
    expect(label).not.toContain('0xabc');
    expect(label).not.toContain('w1');
  });

  test('writes files atomically into new folders', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-cold-atomic-'));
    const target = path.join(dir, 'nested', 'fixtures.json');
    writeFileAtomic(target, 'one');
    writeFileAtomic(target, 'two');
    expect(fs.readFileSync(target, 'utf8')).toBe('two');
    expect(fs.readdirSync(path.dirname(target))).toEqual(['fixtures.json']);
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
