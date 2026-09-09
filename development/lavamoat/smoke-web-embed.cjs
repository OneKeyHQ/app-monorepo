// cspell:ignore lavamoat kaspa KRC kasplex sompi

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseArgs } = require('node:util');

const { chromium } = require('playwright-core');

const { LavaMoatError } = require('./error.cjs');

const { parse } = createRequire(require.resolve('jsdom'))('parse5');

async function withDeadline(operation, milliseconds) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new LavaMoatError('Web Embed API dispatch exceeded its deadline'),
          );
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// This function is serialized into the page by Playwright. Keep all inputs local
// and public: no seed, private key, signing method, network client, or real UTXO.
async function buildPublicKaspaTransaction(
  dispatch = globalThis.$onekey.$private.webembedReceiveHandler,
) {
  const accountAddress =
    'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9';
  const commit = await dispatch({
    data: {
      module: 'chainKaspa',
      method: 'buildCommitTxInfo',
      params: [
        {
          accountAddress,
          transferDataString:
            '{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}',
          isTestnet: false,
        },
      ],
    },
  });
  // The real WASM transaction generator needs Web Crypto randomness even though
  // no signature is requested. Deserialization alone does not exercise that path.
  const reveal = await dispatch({
    data: {
      module: 'chainKaspa',
      method: 'createKRC20RevealTxJSON',
      params: [
        {
          accountAddress,
          isTestnet: false,
          encodedTx: {
            inputs: [
              {
                address: commit.commitAddress,
                txid: 'ab'.repeat(32),
                scriptPubKey: commit.commitScriptPubKey,
                blockDaaScore: 123_456n,
              },
            ],
            changeAddress: accountAddress,
            feeInfo: { price: '1' },
          },
        },
      ],
    },
  });
  const transaction = await dispatch({
    data: {
      module: 'chainKaspa',
      method: 'deserializeFromSafeJSON',
      params: [reveal],
    },
  });
  return { commit, revealSafeJson: reveal, transaction };
}

function validatePublicKaspaTransaction(result) {
  assert.deepEqual(Object.keys(result.commit).toSorted(), [
    'commitAddress',
    'commitScriptHex',
    'commitScriptPubKey',
  ]);
  assert.match(result.commit.commitAddress, /^kaspa:[a-z0-9]+$/);
  assert.match(result.commit.commitScriptHex, /^(?:[a-f0-9]{2})+$/);
  assert.match(result.commit.commitScriptPubKey, /^(?:[a-f0-9]{2})+$/);
  assert.equal(typeof result.revealSafeJson, 'string');
  const reveal = JSON.parse(result.revealSafeJson);
  const { transaction } = result;
  assert.equal(transaction.version, 0);
  assert.equal(reveal.version, transaction.version);
  assert.equal(reveal.inputs.length, 1);
  assert.equal(transaction.inputs.length, 1);
  assert.deepEqual(transaction.inputs[0].previousOutpoint, {
    transactionId: 'ab'.repeat(32),
    index: 0,
  });
  assert.equal(
    reveal.inputs[0].transactionId,
    transaction.inputs[0].previousOutpoint.transactionId,
  );
  assert.equal(
    reveal.inputs[0].index,
    transaction.inputs[0].previousOutpoint.index,
  );
  // The pinned SDK maps the explicit empty safeJSON signature to an undefined
  // TransactionInput getter. Require the original unsigned evidence first.
  assert.equal(Object.hasOwn(reveal.inputs[0], 'signatureScript'), true);
  assert.equal(reveal.inputs[0].signatureScript, '');
  assert.ok(
    transaction.inputs[0].signatureScript === undefined ||
      transaction.inputs[0].signatureScript === '',
  );
  assert.equal(reveal.outputs.length, 1);
  assert.equal(transaction.outputs.length, 1);
  assert.equal(reveal.outputs[0].value, transaction.outputs[0].amount);
  assert.match(transaction.outputs[0].amount, /^\d+$/);
  const change = BigInt(transaction.outputs[0].amount);
  // The wrapper uses a synthetic 1.3 KAS input; only a positive fee may be spent.
  assert.ok(change >= 20_000_000n && change < 130_000_000n);
  assert.equal(transaction.lockTime, '0');
  assert.equal(
    transaction.subnetworkId,
    '0000000000000000000000000000000000000000',
  );
  assert.equal(transaction.gas, '0');
  assert.equal(transaction.payload, '');
  for (const field of ['lockTime', 'subnetworkId', 'gas', 'payload']) {
    assert.equal(reveal[field], transaction[field]);
  }
}

function validateArtifact(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [];
  function visit(node) {
    if (node.tagName === 'script') {
      const attributes = Object.fromEntries(
        node.attrs.map(({ name, value }) => [name, value]),
      );
      if (attributes.src) scripts.push(attributes);
    }
    node.childNodes?.forEach(visit);
  }
  visit(parse(html));
  assert.equal(scripts.length, 3, 'Expected runtime, Sentry and application');
  const names = ['lavamoat-runtime', 'web-embed-sentry', 'main'];
  const sesRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const ses = fs.readFileSync(sesRequire.resolve('ses'), 'utf8');
  for (const [index, script] of scripts.entries()) {
    assert.match(
      script.src,
      new RegExp(`^\\./${names[index]}\\.[a-f0-9]{10}\\.bundle\\.js$`),
    );
    const source = fs.readFileSync(path.join(root, script.src));
    assert.equal(source.toString().split(ses).length - 1, index === 0 ? 1 : 0);
    assert.equal(
      script.integrity,
      `sha384-${createHash('sha384').update(source).digest('base64')}`,
    );
    assert.equal(script.crossorigin, 'anonymous');
    assert.match(source.toString(), index === 0 ? /\._LM_\s*=/ : /\._LM_\(/);
  }
  return {
    indexSha256: createHash('sha256').update(html).digest('hex'),
    scripts: scripts.map(({ src }) => src),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      chrome: { type: 'string' },
      output: { type: 'string' },
      'file-ota': { type: 'boolean', default: false },
    },
  });
  const root = fs.realpathSync(
    path.resolve(__dirname, '../../apps/web-embed/web-build'),
  );
  const output = values.output
    ? path.resolve(values.output)
    : fs.mkdtempSync(
        path.join(os.tmpdir(), 'onekey-lavamoat-web-embed-smoke-'),
      );
  fs.mkdirSync(output, { recursive: true });
  const report = {
    status: 'running',
    artifact: validateArtifact(root),
    transport: values['file-ota'] ? 'file-ota' : 'http',
    fileAccess: values['file-ota']
      ? 'Mirrors existing OTA WebView allowFileAccessFromFileURLs; bundled native assets require separate device acceptance'
      : undefined,
    nativeBridge:
      'explicit test fixture; native transport requires device acceptance',
    routes: [],
  };
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const relative =
        decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = fs.realpathSync(path.join(root, relative));
      if (
        !file.startsWith(`${root}${path.sep}`) ||
        !fs.statSync(file).isFile()
      ) {
        response.writeHead(404).end();
        return;
      }
      const types = {
        '.js': 'text/javascript',
        '.html': 'text/html',
        '.wasm': 'application/wasm',
      };
      const type = types[path.extname(file)] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  if (!values['file-ota']) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  }
  let browser;
  try {
    const executablePath =
      values.chrome ||
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME ||
      (fs.existsSync(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      )
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined);
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: values['file-ota'] ? ['--allow-file-access-from-files'] : [],
    });
    const origin = values['file-ota']
      ? pathToFileURL(`${root}${path.sep}`).href
      : `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/#/webembed/api']) {
      const result = {
        status: 'running',
        route,
        exceptions: [],
        consoleErrors: [],
        assetFailures: [],
        rejections: [],
        bridgeCalls: [],
      };
      report.routes.push(result);
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.exposeFunction('__onekeyWebEmbedRejection', (message) =>
          result.rejections.push(message),
        );
        await page.exposeFunction('__onekeyWebEmbedBridgeCall', (method) =>
          result.bridgeCalls.push(method),
        );
        await page.addInitScript(() => {
          class WebEmbedFixtureError extends Error {}
          const reportRejection = globalThis.__onekeyWebEmbedRejection;
          const reportBridgeCall = globalThis.__onekeyWebEmbedBridgeCall;
          delete globalThis.__onekeyWebEmbedRejection;
          delete globalThis.__onekeyWebEmbedBridgeCall;
          addEventListener('unhandledrejection', (event) => {
            void reportRejection(String(event.reason?.stack || event.reason));
          });
          globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS = {
            isDev: false,
            enableTestEndpoint: false,
            themeVariant: 'light',
            localeVariant: 'en-US',
            revenuecatApiKey: '',
            instanceId: 'lavamoat-e2e-fixture',
            platform: 'ios',
            appBuildNumber: '1',
            appVersion: '1.0.0',
          };
          // Only the native side of the handshake is a fixture. The production
          // route installs its real API dispatcher and loads real lazy modules.
          globalThis.$onekey = {
            $private: {
              async request({ method }) {
                await reportBridgeCall(method);
                if (method === 'getSensitiveEncodeKey')
                  return 'lavamoat-e2e-public-fixture-key';
                if (method === 'webEmbedApiReady') return true;
                throw new WebEmbedFixtureError(
                  `Unexpected native fixture request: ${method}`,
                );
              },
            },
          };
        });
        page.on('pageerror', (error) => result.exceptions.push(String(error)));
        page.on('console', (message) => {
          if (message.type() === 'error')
            result.consoleErrors.push(message.text());
        });
        page.on('requestfailed', (request) => {
          if (request.url().startsWith(origin))
            result.assetFailures.push(request.url());
        });
        page.on('response', (response) => {
          if (response.url().startsWith(origin) && response.status() >= 400)
            result.assetFailures.push(`${response.status()} ${response.url()}`);
        });
        const target = values['file-ota']
          ? `${pathToFileURL(path.join(root, 'index.html')).href}${route.slice(1)}`
          : `${origin}${route}`;
        await page.goto(target, {
          waitUntil: 'load',
          timeout: 120_000,
        });
        if (route === '/') {
          await page
            .getByRole('heading', { name: 'PageIndex', exact: true })
            .waitFor();
          await page
            .getByRole('link', { name: 'WebEmbedApi', exact: true })
            .click();
        }
        await page.waitForFunction(
          () => document.body.innerText.includes('web-embed init success!'),
          null,
          { timeout: 60_000 },
        );
        result.state = await withDeadline(
          page.evaluate(async () => {
            const dispatch = globalThis.$onekey.$private.webembedReceiveHandler;
            const response = await dispatch({
              data: {
                module: 'test',
                method: 'test1',
                params: ['LavaMoat', 'lazy-route'],
              },
            });
            const settings = await dispatch({
              data: { module: 'test', method: 'test2' },
            });
            const appSecurity = await dispatch({
              data: { module: 'test', method: 'getRuntimeSecurityState' },
            });
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 1;
            const drawing = canvas.getContext('2d');
            drawing.fillStyle = '#000000';
            drawing.fillRect(0, 0, 8, 1);
            drawing.fillStyle = '#ffffff';
            drawing.fillRect(4, 0, 4, 1);
            const bitmap = await dispatch({
              data: {
                module: 'imageUtils',
                method: 'base64ImageToBitmap',
                params: [
                  {
                    base64: canvas.toDataURL('image/png'),
                    width: 8,
                    height: 1,
                  },
                ],
              },
            });
            // An empty public transaction exercises the real lazy WASM loader
            // without creating keys, signing, or contacting a blockchain node.
            const transaction = await dispatch({
              data: {
                module: 'chainKaspa',
                method: 'deserializeFromSafeJSON',
                params: [
                  '{"id":"2c18d5e59ca8fc4c23d9560da3bf738a8f40935c11c162017fbf2c907b7e665c","version":0,"inputs":[],"outputs":[],"subnetworkId":"0000000000000000000000000000000000000000","lockTime":"0","gas":"0","mass":"0","payload":""}',
                ],
              },
            });
            let rejectedUnknownMethod = false;
            try {
              await dispatch({
                data: { module: 'test', method: 'missingFixtureMethod' },
              });
            } catch {
              rejectedUnknownMethod = true;
            }
            return {
              response,
              bitmap,
              transaction,
              settingsInstanceId: settings.instanceId,
              appSecurity,
              rejectedUnknownMethod,
              frozen: [
                Object.prototype,
                Array.prototype,
                Promise.prototype,
              ].map(Object.isFrozen),
              harden: typeof harden,
              mutation: Reflect.set(
                Object.prototype,
                '__onekeyWebEmbedFixture',
                true,
              ),
              asyncReady: await new Promise((resolve) =>
                setTimeout(() => resolve(true), 10),
              ),
            };
          }),
          60_000,
        );
        result.state.kaspaPublicTransaction = await withDeadline(
          page.evaluate(buildPublicKaspaTransaction),
          60_000,
        );
        validatePublicKaspaTransaction(result.state.kaspaPublicTransaction);
        result.state.kaspaPublicTransactionRepeat = await withDeadline(
          page.evaluate(buildPublicKaspaTransaction),
          60_000,
        );
        validatePublicKaspaTransaction(
          result.state.kaspaPublicTransactionRepeat,
        );
        assert.deepEqual(
          result.state.kaspaPublicTransactionRepeat,
          result.state.kaspaPublicTransaction,
          'Repeated public Kaspa generation must preserve unsigned transaction semantics',
        );
        assert.equal(
          result.state.response,
          `LavaMoat---lazy-route: ${page.url()}`,
        );
        assert.equal(result.state.settingsInstanceId, 'lavamoat-e2e-fixture');
        assert.deepEqual(result.state.appSecurity, {
          hardenType: 'function',
          objectFrozen: true,
          arrayFrozen: true,
          functionFrozen: true,
          promiseFrozen: true,
        });
        assert.equal(result.state.bitmap, '0f');
        assert.deepEqual(result.state.transaction, {
          version: 0,
          inputs: [],
          outputs: [],
          mass: '0',
          lockTime: '0',
          subnetworkId: '0000000000000000000000000000000000000000',
          gas: '0',
          payload: '',
        });
        assert.equal(result.state.rejectedUnknownMethod, true);
        assert.deepEqual(result.state.frozen, [true, true, true]);
        assert.equal(result.state.harden, 'function');
        assert.equal(result.state.mutation, false);
        assert.equal(result.state.asyncReady, true);
        assert.deepEqual(result.bridgeCalls, [
          'getSensitiveEncodeKey',
          'webEmbedApiReady',
        ]);
        await page.screenshot({
          path: path.join(
            output,
            route === '/' ? 'navigation.png' : 'deep-link.png',
          ),
        });
        assert.deepEqual(result.exceptions, []);
        assert.deepEqual(result.rejections, []);
        assert.deepEqual(result.assetFailures, []);
        assert.deepEqual(result.consoleErrors, []);
        result.status = 'passed';
      } catch (error) {
        result.status = 'failed';
        result.error = String(error.stack || error);
        throw error;
      } finally {
        await page
          .screenshot({
            timeout: 5000,
            path: path.join(
              output,
              route === '/' ? 'navigation-final.png' : 'deep-link-final.png',
            ),
          })
          .catch((error) => {
            result.screenshotError = String(error);
          });
        await context.close();
        fs.writeFileSync(
          path.join(output, 'report.json'),
          `${JSON.stringify(report, null, 2)}\n`,
        );
      }
    }
    report.status = 'passed';
    console.log(
      `Protected web-embed production browser checks passed. Evidence: ${output}`,
    );
  } catch (error) {
    report.status = 'failed';
    report.error = String(error.stack || error);
    throw error;
  } finally {
    await browser?.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(
      path.join(output, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error : new LavaMoatError(String(error)),
    );
    process.exitCode = 1;
  });
}

module.exports = {
  buildPublicKaspaTransaction,
  validateArtifact,
  validatePublicKaspaTransaction,
  withDeadline,
};
