const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createFixtureStore,
  createRecorder,
  installNetworkIsolation,
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
  test.each(['fixtures', 'record'])(
    '%s mode keeps device recall data out of recordings',
    async (mode) => {
      let handleRoute;
      const context = {
        routeWebSocket: jest.fn(),
        route: jest.fn(async (_matches, handler) => {
          handleRoute = handler;
        }),
        on: jest.fn(),
      };
      const stats = await installNetworkIsolation({
        context,
        mode,
        localOrigin: 'http://127.0.0.1:3000',
        fixtureStore: createFixtureStore({ entries: [] }),
        recorder: createRecorder({ fixturePath: tempFixturePath() }),
        scenarioName: 'perps',
      });
      const request = {
        method: () => 'GET',
        url: () =>
          'https://rebate.onekeycn.com/rebate/v1/recall/progress?instanceId=test-device',
        postData: () => null,
        resourceType: () => 'xhr',
      };
      const route = {
        request: () => request,
        fulfill: jest.fn(),
        abort: jest.fn(),
      };
      await handleRoute(route);
      expect(route.fulfill).toHaveBeenCalledWith(
        expect.objectContaining({ status: 204, body: '' }),
      );
      expect(route.abort).not.toHaveBeenCalled();
      expect(stats.stubbed).toEqual({ 'recall-ineligible': 1 });
      expect(stats.recorded).toEqual({});
      expect(stats.blocked).toEqual([]);
      expect(
        recordRefusal({
          method: request.method(),
          url: request.url(),
          headers: {},
        }),
      ).toBe('endpoint not in RECORDABLE_ENDPOINTS');
    },
  );

  test('covers the homepage highlight quote prefetch with recordable fixtures', () => {
    const file = readFixtureFile(
      path.join(__dirname, '..', 'fixtures', 'web-cold-api.json'),
    );
    const store = createFixtureStore(file);
    const highlights = store.lookup({
      method: 'GET',
      url: 'https://utility.onekeycn.com/utility/v1/market/highlight',
    }).entry.json.data.data;
    const assets = highlights
      .slice(0, 3)
      .flatMap((item) => item.assets.slice(0, 3));
    const requests = [
      {
        path: '/utility/v2/market/token/list/batch',
        body: {
          currency: 'usd',
          tokenAddressList: assets
            .filter((asset) => asset.type === 'token')
            .map(({ chainId, contractAddress, isNative }) => ({
              chainId,
              contractAddress,
              isNative,
            })),
        },
      },
      {
        path: '/utility/v1/stocks/batch',
        body: {
          stockIds: assets
            .filter((asset) => asset.type === 'stock')
            .map((asset) => asset.stockId),
        },
      },
    ];
    for (const { path: endpoint, body } of requests) {
      const request = {
        method: 'POST',
        url: `https://utility.onekeycn.com${endpoint}`,
        postData: JSON.stringify(body),
      };
      expect(recordRefusal(request)).toBeNull();
      expect(store.lookup(request).entry?.json.code).toBe(0);
    }
  });

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

  test('matches hourly candle windows without mixing coins or intervals', () => {
    const request = (req) => ({
      method: 'POST',
      url: 'https://api.hyperliquid.xyz/info',
      postData: JSON.stringify({
        type: 'candleSnapshot',
        req: {
          coin: 'xyz:NVDA',
          interval: '1h',
          startTime: 0,
          endTime: 10,
          ...req,
        },
      }),
    });
    const key = requestKey(request({}));
    expect(key).toBe(
      'POST api.hyperliquid.xyz/info {"req":{"coin":"xyz:NVDA","interval":"1h"},"type":"candleSnapshot"}',
    );
    expect(requestKey(request({ startTime: 100, endTime: 110 }))).toBe(key);
    const store = createFixtureStore({ entries: [{ key, json: [] }] });
    for (const req of [
      { coin: 'BTC' },
      { interval: '4h' },
      { user: '0xprivate' },
      { startTime: -1 },
      { startTime: 11 },
      { endTime: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(store.lookup(request(req)).entry).toBeNull();
    }
    expect(
      store.lookup({ ...request({}), url: 'https://other.onekeycn.com/info' })
        .entry,
    ).toBeNull();
  });

  test('replays recorded candles in the current window with a stable pagination anchor', () => {
    const hour = 3_600_000;
    const request = (startTime, endTime) => ({
      method: 'POST',
      url: 'https://api.hyperliquid.xyz/info',
      postData: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin: 'xyz:NVDA', interval: '1h', startTime, endTime },
      }),
    });
    const bars = [1, 2, 3].map((n) => ({
      t: n * hour,
      T: (n + 1) * hour - 1,
      s: 'xyz:NVDA',
      i: '1h',
      o: '100',
      h: '110',
      l: '90',
      c: '105',
      v: '42',
      n: 8,
    }));
    const now = jest.spyOn(Date, 'now').mockReturnValue(100 * hour + 1234);
    try {
      const store = createFixtureStore({
        entries: [{ key: requestKey(request(0, hour)), json: bars }],
      });
      const latest = store.lookup(request(99 * hour, 100 * hour + 1234)).entry
        .json;
      expect(latest).toEqual([
        { ...bars[1], t: 99 * hour, T: 100 * hour - 1 },
        { ...bars[2], t: 100 * hour, T: 101 * hour - 1 },
      ]);
      now.mockReturnValue(101 * hour);
      expect(
        store.lookup(request(98 * hour, 99 * hour - 1)).entry.json,
      ).toEqual([{ ...bars[0], t: 98 * hour, T: 99 * hour - 1 }]);
      expect(store.lookup(request(0, 97 * hour)).entry.json).toEqual([]);
      expect(bars[0].t).toBe(hour);
    } finally {
      now.mockRestore();
    }
  });

  test('records only public hourly candle bodies without credentials or extra fields', () => {
    const body = {
      type: 'candleSnapshot',
      req: {
        coin: 'xyz:NVDA',
        interval: '1h',
        startTime: 1_791_995_142_000,
        endTime: 1_793_795_142_000,
      },
    };
    const request = {
      method: 'POST',
      url: 'https://api.hyperliquid.xyz/info',
      postData: JSON.stringify(body),
    };
    expect(recordRefusal(request)).toBeNull();
    for (const headers of [
      { authorization: 'secret' },
      { cookie: 'secret' },
      { 'x-onekey-request-token': 'secret' },
    ]) {
      expect(recordRefusal({ ...request, headers })).toMatch(/^carries /);
    }
    for (const invalid of [
      { ...body, user: '0xprivate' },
      { ...body, req: { ...body.req, user: '0xprivate' } },
      { ...body, req: { ...body.req, interval: '4h' } },
      { ...body, req: { ...body.req, startTime: -1 } },
      { ...body, req: { ...body.req, startTime: body.req.endTime + 1 } },
    ]) {
      expect(
        recordRefusal({ ...request, postData: JSON.stringify(invalid) }),
      ).toBe('request body not allowed for this endpoint');
    }
    expect(
      recordRefusal({ ...request, url: `${request.url}?user=private` }),
    ).toBe('query parameter not allowed for this endpoint');
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
        url: 'https://wallet.onekeycn.com/wallet/v1/health?_=system_time_utils&timestamp=1792507483129',
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
    ).toBe('query parameter not allowed for this endpoint');
    // Volatile parameters are only accepted where a route lists them, with a
    // value that matches its pattern.
    expect(
      recordRefusal({
        method: 'GET',
        url: 'https://swap.onekeycn.com/swap/v1/networks?protocol=All&timestamp=1792507483129',
        headers: {},
      }),
    ).toBe('query parameter not allowed for this endpoint');
    for (const query of [
      '_=system_time_utils&timestamp=0xabc',
      '_=other&timestamp=1792507483129',
    ]) {
      expect(
        recordRefusal({
          method: 'GET',
          url: `https://wallet.onekeycn.com/wallet/v1/health?${query}`,
          headers: {},
        }),
      ).toBe('query parameter value not allowed for this endpoint');
    }
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
    expect(
      redactUrl(
        'https://wallet.onekeycn.com/wallet/v1/account/0x52908400098527886E0F7030069857D2E4169EE7/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/history?0xabc=1&page=2',
      ),
    ).toBe(
      'https://wallet.onekeycn.com/wallet/v1/account/:id/token/:id/history?:param&page',
    );
    expect(
      redactUrl(
        'https://utility.onekeycn.com/utility/v2/market/banner/token-list/6aaa5bf8185583c1679c37dc',
      ),
    ).toBe(
      'https://utility.onekeycn.com/utility/v2/market/banner/token-list/:id',
    );
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
