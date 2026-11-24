// cspell:words tlds

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const test = require('node:test');
const vm = require('node:vm');

const decode = require('decode-uri-component');
const redirects = require('follow-redirects');
const Joi = require('joi');
const forge = require('node-forge');
const queryString = require('query-string');

test('query-string retains its CommonJS decoder contract after the security upgrade', () => {
  assert.equal(typeof decode, 'function');
  assert.equal(decode('%E4%BD%A0%E5%A5%BD'), '你好');
  assert.equal(decode('%E0%A4%A'), '%E0%A4%A');
  assert.deepEqual(
    { ...queryString.parse('name=hello+world&value=%2B&unicode=%E4%BD%A0') },
    { name: 'hello world', value: '+', unicode: '你' },
  );
  const value = { name: 'hello world', value: '+', unicode: '你' };
  assert.deepEqual(
    { ...queryString.parse(queryString.stringify(value)) },
    value,
  );
});

test('malformed percent input finishes without recursive or quadratic decoding', () => {
  // A subprocess timeout also bounds a regression that blocks the JS event loop.
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `const assert = require('node:assert/strict');
       const decode = require(${JSON.stringify(require.resolve('decode-uri-component'))});
       const input = '%FF'.repeat(100000);
       assert.equal(decode(input), input);
       assert.equal(decode('%41%FF'.repeat(100000)), 'A%FF'.repeat(100000));
       let distinctRuns = '';
       for (let i = 0; i < 32000; i++) {
         distinctRuns += '%' + Math.floor(i / 256).toString(16).padStart(2, '0') +
           '%' + (i % 256).toString(16).padStart(2, '0') + 'x';
       }
       assert.ok(decode(distinctRuns + '%zz').endsWith('%zz'));
       const Joi = require(${JSON.stringify(require.resolve('joi'))});
       assert.ok(Joi.string().email({ multiple: true }).validate(' '.repeat(200000)).error);`,
    ],
    { timeout: 5000, encoding: 'utf8' },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('patched Joi retains email validation and rejects malformed addresses', () => {
  const schema = Joi.string().email({ tlds: { allow: false } });
  assert.equal(schema.validate('test@example.com').error, undefined);
  assert.ok(schema.validate('not-an-email').error);
  assert.ok(schema.validate(`${'a'.repeat(100_000)}@example.com`).error);
});

test('node-forge retains the certificate tooling ASN.1 and hash contracts', () => {
  const value = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.UTF8,
    false,
    'public test value',
  );
  assert.equal(
    forge.asn1.fromDer(forge.asn1.toDer(value)).value,
    'public test value',
  );
  assert.equal(
    forge.md.sha256.create().update('abc').digest().toHex(),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('cross-origin redirects discard sensitive headers', async (t) => {
  const target = http.createServer((request, response) => {
    response.end(JSON.stringify(request.headers));
  });
  const origin = http.createServer((request, response) => {
    response.writeHead(302, {
      Location: `http://127.0.0.1:${target.address().port}/target`,
    });
    response.end();
  });
  for (const server of [target, origin]) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
  }
  const headers = await new Promise((resolve, reject) => {
    const request = redirects.http.get(
      `http://127.0.0.1:${origin.address().port}/redirect`,
      {
        sensitiveHeaders: vm.runInNewContext("['X-Public-Fixture']"),
        headers: {
          'X-Public-Fixture': 'public-regression-fixture',
          'X-Harmless': 'preserved',
          Authorization: 'public-regression-fixture',
          Cookie: 'fixture=public',
          'Proxy-Authorization': 'public-regression-fixture',
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve(JSON.parse(body)));
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy());
  });
  assert.equal(headers['x-public-fixture'], undefined);
  assert.equal(headers['x-harmless'], 'preserved');
  assert.equal(headers.authorization, undefined);
  assert.equal(headers.cookie, undefined);
  assert.equal(headers['proxy-authorization'], undefined);
});
