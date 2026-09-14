// cspell:ignore nextcursor automations
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { LokaliseClient, translationRecords } = require('./workflow-client');

function client(fetchImpl) {
  return new LokaliseClient({
    token: 'secret-canary',
    projectId: 'project-test',
    fetchImpl,
    wait: async () => {},
  });
}

test('GET retries are bounded; writes and auth errors are never retried or exposed', async () => {
  let requests = 0;
  const retry = client(async () => {
    requests += 1;
    return new Response('{}', { status: requests < 3 ? 429 : 200 });
  });
  await retry.request('GET');
  assert.equal(requests, 3);
  requests = 0;
  const failed = client(async () => {
    requests += 1;
    throw new Error('secret-canary');
  });
  await assert.rejects(
    () => failed.request('POST', '/keys', {}),
    (error) => !error.message.includes('secret-canary'),
  );
  assert.equal(requests, 1);
  requests = 0;
  const auth = client(async () => {
    requests += 1;
    return new Response('secret-canary', { status: 401 });
  });
  await assert.rejects(() => auth.request('GET'), /HTTP 401/);
  assert.equal(requests, 1);
  await assert.rejects(
    () =>
      client(
        async () => new Response('{"errors":[{"message":"secret-canary"}]}'),
      ).request('POST', '/keys', {}),
    /partial-write/,
  );
});

test('exact key lookup paginates, rejects ambiguity, and checks web names', async () => {
  const first = { key_id: 1, key_name: { web: 'other__title' } };
  const second = { key_id: 2, key_name: { web: 'global::existing' } };
  let requests = 0;
  const api = client(async (url) => {
    requests += 1;
    const query = new URL(url).searchParams;
    assert.equal(query.get('include_translations'), '1');
    return query.get('cursor')
      ? Response.json({ keys: [second] })
      : Response.json({ keys: [first] }, { headers: { nextcursor: 'next' } });
  });
  assert.equal((await api.findKey('global.existing')).key_id, 2);
  assert.equal(requests, 2);
  await assert.rejects(
    () =>
      client(async () =>
        Response.json({ keys: [second, { ...second, key_id: 3 }] }),
      ).findKey('global.existing'),
    /Ambiguous/,
  );
  await assert.rejects(
    () =>
      client(async () =>
        Response.json({
          keys: [{ key_id: 2, key_name: { web: 'other', ios: 'wanted' } }],
        }),
      ).findKey('wanted'),
    /per-platform/,
  );
});

test('create includes every language and updates address translation records', async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({});
  });
  await api.create(
    {
      key: 'hello__title',
      translations: { en_US: 'Hello', zh_CN: '你好', de: 'Hallo' },
    },
    { en_US: 'en-us', zh_CN: 'zh-cn', de: 'de' },
  );
  const body = JSON.parse(calls[0].body);
  assert.equal(body.keys[0].translations.length, 3);
  assert.equal(body.use_automations, false);
  await api.updateTranslation(123, 'Neu');
  assert(calls[1].url.endsWith('/translations/123'));
  assert.equal(calls[1].method, 'PUT');
  assert.throws(
    () =>
      translationRecords({ key_id: 1, translations: [] }, { en_US: 'en-us' }),
    /missing/,
  );
  assert.throws(() => translationRecords({ is_plural: true }, {}), /plural/);
});
