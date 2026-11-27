// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { chromium } = require('playwright-core');
const webpack = require('webpack');

const {
  startBrowser,
  interceptTargets,
  installRejectionObserver,
} = require('../../apps/ext/scripts/smoke-lavamoat.cjs');
const { key: manifestKey } = require('../../apps/ext/src/manifest/shared');
const {
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackValidationPlugin,
} = require('../webpack/lavamoat');

const { LavaMoatError } = require('./error.cjs');
const { javascriptLiteral } = require('./javascript-literal.cjs');

const repo = path.resolve(__dirname, '../..');

// UI, background and actual offscreen have independent JS heaps. A normal
// host page loads the real injected library; the protected content script only
// relays it. This is SDK transport coverage, not a full wallet UI smoke.
test('actual MV3 SDK bridges require background origin and retain native sender and peer checks', async () => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-origin-')),
  );
  const previous = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  const installed = (name) => path.join(repo, 'node_modules', name);
  const json = JSON.stringify;
  const write = (file, body) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  };
  const sha = (file) =>
    createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const core = '@onekeyfe/cross-inpage-provider-core/dist/JsBridgeBase.js';
  const productionOwner = `external:../../node_modules/${core}`;
  for (const target of ['background', 'pages', 'content-script']) {
    const override = JSON.parse(
      fs.readFileSync(
        path.join(
          repo,
          'lavamoat/webpack/ext/mv3',
          target,
          'policy-override.json',
        ),
        'utf8',
      ),
    );
    assert.equal(
      override.resources[productionOwner]?.globals?.['location.origin'],
      target === 'background' ? true : undefined,
      'Only the proven background sender requires an additional origin grant',
    );
  }
  const hosted = '@onekeyfe/extension-bridge-hosted/dist/';
  // Test-only root state is observable through its own Chrome runtime object.
  // SDK classes keep their real send/receive implementation; subclasses only
  // record the rejection and rethrow it, never synthesize successful replies.
  const observe = `globalThis.fixture={received:[],rejected:[],results:[],done:false};chrome.runtime.__originFixture=fixture;
function metadata(payload){return {origin:payload.origin,internal:payload.internal,method:payload.data?.method,scope:payload.scope};}
`;
  const background = `${observe}
import {IJsBridgeMessageTypes} from ${javascriptLiteral(installed('@onekeyfe/cross-inpage-provider-types/dist/index.js'))};
import {JsBridgeExtBackground} from ${javascriptLiteral(installed(`${hosted}JsBridgeExtBackground.js`))};
import probe from './node_modules/origin-neighbor/index.js';
fixture.denied=probe();
class ObservedBackground extends JsBridgeExtBackground {
 receive(...args){try{return super.receive(...args)}catch(error){fixture.rejected.push({message:error.message});throw error;}}
}
const bridge=new ObservedBackground({receiveHandler:async payload=>{
 fixture.received.push(metadata(payload));
 if(payload.data.method==='ping')return metadata(payload);
 if(payload.data.method==='wrong-peer'){
  try{await bridge.send({type:IJsBridgeMessageTypes.REQUEST,remoteId:payload.remoteId,peerOrigin:'https://untrusted.invalid',data:{method:'must-not-arrive'}});throw Error('Incorrectly delivered wrong-origin request');}
  catch(error){return {rejected:error.message.startsWith('Origin not matched!')};}
 }
 if(payload.data.method==='offscreen-roundtrip')return bridge.requestToOffscreen({method:'offscreen-ping'});
 throw Error('Unexpected fixture method');
}});
chrome.offscreen.createDocument({url:'offscreen.html',reasons:['DOM_SCRAPING'],justification:'Test actual SDK offscreen RPC source metadata'}).then(()=>{fixture.offscreenCreated=true;});
globalThis.fixtureBridge=bridge;
`;
  const pages = `${observe}
import {JsBridgeExtUi} from ${javascriptLiteral(installed(`${hosted}JsBridgeExtUi.js`))};
import {JsBridgeExtOffscreen} from ${javascriptLiteral(installed(`${hosted}JsBridgeExtOffscreen.js`))};
import probe from './node_modules/origin-neighbor/index.js';
fixture.denied=probe();
const offscreen=location.pathname==='/offscreen.html';
const Base=offscreen?JsBridgeExtOffscreen:JsBridgeExtUi;
class ObservedPage extends Base {sendPayload(payload){fixture.sentOrigin=payload.origin;return super.sendPayload(payload);}receive(...args){try{return super.receive(...args)}catch(error){fixture.rejected.push({message:error.message});throw error;}}}
const bridge=new ObservedPage({receiveHandler:payload=>{fixture.received.push(metadata(payload));return metadata(payload);},onPortConnect(){fixture.connected=true;}});
globalThis.fixtureBridge=bridge;
fixture.request=(method)=>bridge.request({data:{method}});
fixture.request('ping').then(result=>{fixture.results.push(result);fixture.done=true;});
`;
  const content = `${observe}
import setup from ${javascriptLiteral(installed(`${hosted}bridgeSetup/contentScript.js`))};
setup.setupMessagePort();
fixture.relayReady=true;
`;
  const injected = `import {JsBridgeExtInjected} from ${javascriptLiteral(installed('@onekeyfe/extension-bridge-injected/dist/JsBridgeExtInjected.js'))};
globalThis.fixtureInjected=new JsBridgeExtInjected({});
`;
  const proof = { sourceHashes: {}, graphs: {}, runs: [] };
  for (const file of [
    core,
    `${hosted}JsBridgeExtBackground.js`,
    `${hosted}JsBridgeExtUi.js`,
    `${hosted}JsBridgeExtOffscreen.js`,
    `${hosted}bridgeSetup/contentScript.js`,
    '@onekeyfe/extension-bridge-injected/dist/JsBridgeExtInjected.js',
  ])
    proof.sourceHashes[file] = sha(installed(file));
  async function compile(role, generate, grant) {
    const dir = path.join(root, 'graphs', role);
    write(
      path.join(dir, 'package.json'),
      json({
        name: `origin-${role}`,
        private: true,
        dependencies: { 'origin-neighbor': '1.0.0' },
      }),
    );
    write(
      path.join(dir, 'entry.js'),
      { background, pages, content, injected }[role],
    );
    write(
      path.join(dir, 'node_modules/origin-neighbor/package.json'),
      json({ name: 'origin-neighbor', version: '1.0.0' }),
    );
    write(
      path.join(dir, 'node_modules/origin-neighbor/index.js'),
      'export default()=>({location:typeof location,chrome:typeof chrome,fetch:typeof fetch});',
    );
    const inline = { background: 'background', content: 'content-script' }[
      role
    ];
    const output = path.join(
      root,
      'outputs',
      `${role}-${grant ? 'grant' : 'missing'}`,
    );
    const plugins = [];
    if (role !== 'injected') {
      const plugin = createLavaMoatWebpackPlugin({
        basePath: dir,
        target: 'ext',
        inlineRuntime: inline,
        readableResourceIds: true,
      });
      plugin.options.policyLocation = dir;
      plugin.options.generatePolicyOnly = generate;
      plugin.options.generatePolicy = generate;
      plugins.push(plugin);
      if (!generate)
        plugins.push(
          createLavaMoatWebpackValidationPlugin({ inlineRuntime: inline }),
        );
    }
    let filename = '[name].[contenthash:10].bundle.js';
    if (inline) filename = `${inline}.bundle.js`;
    else if (role === 'injected') filename = 'injected.js';
    const compiler = webpack({
      mode: 'production',
      context: dir,
      entry: './entry.js',
      target:
        role === 'background' ? ['webworker', 'es2022'] : ['web', 'es2022'],
      node: { global: false },
      devtool: false,
      resolve: {
        modules: [path.join(repo, 'node_modules')],
        extensions: ['.js', '.json'],
      },
      output: {
        clean: true,
        path: output,
        filename,
        chunkFilename: '[name].[contenthash:10].chunk.js',
        publicPath: '/',
        crossOriginLoading: 'anonymous',
      },
      optimization: {
        minimize: false,
        runtimeChunk: role === 'pages' ? { name: 'lavamoat-runtime' } : false,
      },
      plugins,
    });
    try {
      const stats = await new Promise((resolve, reject) =>
        compiler.run((error, result) =>
          error ? reject(error) : resolve(result),
        ),
      );
      assert.equal(
        stats.hasErrors(),
        false,
        stats.toString({ all: false, errors: true }),
      );
      const policyMode = grant ? 'grant' : 'missing';
      proof.graphs[`${role}-${generate ? 'generate' : policyMode}`] = {
        modules: stats.compilation.modules.size,
        warnings: stats
          .toJson({ all: false, warnings: true })
          .warnings.map((w) => w.message),
      };
    } finally {
      await new Promise((resolve, reject) =>
        compiler.close((e) => (e ? reject(e) : resolve())),
      );
    }
    if (generate) {
      const policyFile = path.join(dir, 'policy.json');
      const policy = JSON.parse(fs.readFileSync(policyFile));
      const owner = Object.keys(policy.resources).find((name) =>
        name.endsWith('/JsBridgeBase.js'),
      );
      assert.ok(
        owner,
        'SDK module must retain its exact physical module owner',
      );
      proof.graphs[`${role}-owner`] = owner;
      assert.equal(
        policy.resources[owner].globals?.['location.origin'],
        undefined,
      );
      write(path.join(dir, 'policy.generated.json'), json(policy));
    }
    return output;
  }
  function setPolicy(role, grant) {
    const dir = path.join(root, 'graphs', role);
    const policy = JSON.parse(
      fs.readFileSync(path.join(dir, 'policy.generated.json')),
    );
    const owner = proof.graphs[`${role}-owner`];
    for (const name of Object.keys(policy.resources))
      if (name.includes('origin-neighbor')) policy.resources[name] = {};
    if (grant)
      policy.resources[owner].globals = {
        ...policy.resources[owner].globals,
        'location.origin': true,
      };
    write(path.join(dir, 'policy.json'), json(policy));
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const id = createHash('sha256')
    .update(Buffer.from(manifestKey, 'base64'))
    .digest('hex')
    .slice(0, 32)
    .split('')
    .map((v) => String.fromCharCode(97 + parseInt(v, 16)))
    .join('');
  const origin = `chrome-extension://${id}`;
  async function run(name, bgGrant, pageGrant) {
    const directory = path.join(root, 'runs', name);
    fs.mkdirSync(directory, { recursive: true });
    const extension = path.join(directory, 'extension');
    fs.rmSync(extension, { recursive: true, force: true });
    fs.mkdirSync(extension, { recursive: true });
    for (const [role, grant] of [
      ['background', bgGrant],
      ['pages', pageGrant],
      ['content', false],
    ])
      fs.cpSync(
        path.join(root, 'outputs', `${role}-${grant ? 'grant' : 'missing'}`),
        extension,
        { recursive: true },
      );
    const pageFiles = fs
      .readdirSync(
        path.join(root, 'outputs', `pages-${pageGrant ? 'grant' : 'missing'}`),
      )
      .filter((f) => f.endsWith('.js'))
      .toSorted(
        (a, b) =>
          Number(!a.startsWith('lavamoat-runtime')) -
          Number(!b.startsWith('lavamoat-runtime')),
      );
    for (const html of ['ui.html', 'offscreen.html'])
      fs.writeFileSync(
        path.join(extension, html),
        `<!doctype html><html><head><meta charset="utf-8">${pageFiles
          .map(
            (file) =>
              `<script defer src="/${file}" crossorigin="anonymous" integrity="sha384-${createHash(
                'sha384',
              )
                .update(fs.readFileSync(path.join(extension, file)))
                .digest('base64')}"></script>`,
          )
          .join('')}</head><body>Actual SDK origin fixture</body></html>`,
      );
    fs.writeFileSync(
      path.join(extension, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        name: 'OneKey actual SDK origin fixture',
        version: '1.0.0',
        key: manifestKey,
        permissions: ['offscreen'],
        background: { service_worker: 'background.bundle.js' },
        content_security_policy: {
          extension_pages:
            "script-src 'self' 'wasm-unsafe-eval' ; object-src 'self';",
        },
        content_scripts: [
          {
            matches: ['http://127.0.0.1/*'],
            js: ['content-script.bundle.js'],
            run_at: 'document_start',
          },
        ],
      }),
    );
    const result = {
      name,
      bgGrant,
      pageGrant,
      errors: [],
      observers: [],
      status: 'running',
    };
    let browser, server, cleanupFailure;
    const diagnosticSessions = [];
    try {
      browser = await startBrowser(
        fs.mkdtempSync(path.join(directory, 'profile-')),
        process.env.ONEKEY_LAVAMOAT_TEST_CHROME || chromium.executablePath(),
      );
      const monitors = await interceptTargets(
        browser,
        origin,
        async (session, label, before) => {
          diagnosticSessions.push({ session, label });
          session.on('Log.entryAdded', (event) => {
            if (event.entry.level === 'error')
              result.errors.push({ label, message: event.entry.text });
          });
          await session.send('Log.enable');
          session.on('Runtime.consoleAPICalled', (event) => {
            if (event.type === 'error')
              result.errors.push({
                label,
                message: event.args
                  .map((arg) => arg.description || arg.value)
                  .join(' '),
              });
          });
          session.on('Runtime.exceptionThrown', (event) =>
            result.errors.push({
              label,
              message:
                event.exceptionDetails.exception?.description ||
                event.exceptionDetails.text,
            }),
          );
          session.on('Runtime.bindingCalled', (event) => {
            if (event.name === '__onekeySmokeRejection')
              result.observers.push({ label, ...JSON.parse(event.payload) });
          });
          await session.send('Runtime.enable');
          await installRejectionObserver(session, !before);
        },
        (label, message) => result.errors.push({ label, message }),
      );
      await browser.cdp.send('Extensions.loadUnpacked', { path: extension });
      const target = async (url) => {
        for (let i = 0; i < 100; i += 1) {
          const info = (
            await browser.cdp.send('Target.getTargets')
          ).targetInfos.find((t) => t.url === url);
          if (info && monitors.has(info.targetId))
            return monitors.get(info.targetId);
          await delay(100);
        }
        throw new LavaMoatError(`Target absent ${url}`);
      };
      const read = async (session, expression, extra = {}) => {
        const r = await session.send('Runtime.evaluate', {
          expression: `(()=>{const fixture=globalThis.chrome?.runtime?.__originFixture;return (${expression});})()`,
          returnByValue: true,
          awaitPromise: true,
          ...extra,
        });
        assert.equal(
          r.exceptionDetails,
          undefined,
          r.exceptionDetails?.exception?.description,
        );
        return r.result.value;
      };
      const wait = async (session, expression) => {
        for (let i = 0; i < 80; i += 1) {
          if (await read(session, expression)) return;
          await delay(100);
        }
        throw new LavaMoatError(
          `Fixture condition was not satisfied: ${expression}`,
        );
      };
      const attached = async (targetId) => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (monitors.has(targetId)) return monitors.get(targetId);
          await delay(100);
        }
        throw new LavaMoatError(
          'Fixture page was not intercepted before startup',
        );
      };
      const bg = await target(`${origin}/background.bundle.js`);
      const off = await target(`${origin}/offscreen.html`);
      const pageId = (
        await browser.cdp.send('Target.createTarget', { url: 'about:blank' })
      ).targetId;
      const page = await attached(pageId);
      await page.send('Page.navigate', { url: `${origin}/ui.html` });
      await wait(page, '!!fixture?.connected');
      await wait(off, '!!fixture?.connected');
      if (bgGrant) {
        await wait(page, 'fixture.done');
        await wait(off, 'fixture.done');
      } else {
        await wait(page, 'fixture.rejected.length>0');
        await wait(off, 'fixture.rejected.length>0');
      }
      const state =
        '({done:fixture.done,rejected:fixture.rejected,results:fixture.results,sentOrigin:fixture.sentOrigin,denied:fixture.denied,frozen:Object.isFrozen(Object.prototype),harden:typeof harden})';
      result.ui = await read(page, state);
      result.offscreen = await read(off, state);
      result.background = await read(
        bg,
        '({denied:fixture.denied,frozen:Object.isFrozen(Object.prototype),harden:typeof harden})',
      );
      assert.deepEqual(result.background, {
        denied: {
          location: 'undefined',
          chrome: 'undefined',
          fetch: 'undefined',
        },
        frozen: true,
        harden: 'function',
      });
      assert.equal(result.ui.frozen, true);
      assert.equal(result.offscreen.frozen, true);
      assert.deepEqual(result.ui.denied, {
        location: 'undefined',
        chrome: 'undefined',
        fetch: 'undefined',
      });
      assert.equal(result.ui.sentOrigin, pageGrant ? origin : '');
      assert.equal(result.offscreen.sentOrigin, pageGrant ? origin : '');
      if (bgGrant) {
        assert.equal(result.ui.results[0].origin, origin);
        assert.equal(result.ui.results[0].internal, true);
        assert.equal(result.offscreen.results[0].origin, origin);
        result.roundtrip = await read(
          page,
          "fixture.request('offscreen-roundtrip')",
        );
        assert.equal(result.roundtrip.origin, origin);
        assert.equal(result.roundtrip.internal, true);
        assert.equal(result.roundtrip.method, 'offscreen-ping');
        result.wrongPeer = await read(page, "fixture.request('wrong-peer')");
        assert.deepEqual(result.wrongPeer, { rejected: true });
        assert.equal(
          await read(
            page,
            "fixture.received.some(item=>item.method==='must-not-arrive')",
          ),
          false,
        );
      } else {
        assert.equal(result.ui.done, false);
        assert.equal(result.offscreen.done, false);
        for (const rejectedState of [result.ui, result.offscreen])
          assert.match(
            rejectedState.rejected[0].message,
            /receive message \[payload.origin\] is required/,
          );
      }
      server = http.createServer((request, response) => {
        if (request.url === '/injected.js') {
          response.writeHead(200, { 'content-type': 'text/javascript' });
          response.end(
            fs.readFileSync(
              path.join(root, 'outputs/injected-missing/injected.js'),
            ),
          );
        } else {
          response.writeHead(200, { 'content-type': 'text/html' });
          response.end(
            '<!doctype html><html><head><link rel="icon" href="data:"></head><body><script src="/injected.js"></script>Unprivileged local host</body></html>',
          );
        }
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      const host = `http://127.0.0.1:${server.address().port}`;
      const hostId = (
        await browser.cdp.send('Target.createTarget', { url: 'about:blank' })
      ).targetId;
      const hostPage = await attached(hostId);
      const worlds = [];
      hostPage.on('Runtime.executionContextCreated', (event) =>
        worlds.push(event.context),
      );
      await hostPage.send('Page.navigate', { url: host });
      await wait(hostPage, '!!globalThis.fixtureInjected');
      const contentWorld = worlds.find(
        (w) => w.origin === origin && w.auxData?.isDefault === false,
      );
      assert.ok(contentWorld);
      result.content = await read(
        hostPage,
        '({relayReady:fixture.relayReady,frozen:Object.isFrozen(Object.prototype)})',
        { contextId: contentWorld.id },
      );
      assert.deepEqual(result.content, { relayReady: true, frozen: true });
      result.hostMutable = await read(
        hostPage,
        '!Object.isFrozen(Object.prototype)',
      );
      assert.equal(result.hostMutable, true);
      result.hostRpc = await read(
        hostPage,
        "fixtureInjected.request({scope:'fixture',data:{method:'ping'}})",
      );
      assert.equal(result.hostRpc.origin, host);
      assert.equal(result.hostRpc.internal, false);
      const before = await read(bg, 'fixture.received.length');
      await read(
        hostPage,
        `fixtureInjected.sendPayload({id:99001,type:'REQUEST',scope:'fixture',origin:${javascriptLiteral(origin)},internal:true,data:{method:'ping'}})`,
      );
      await wait(bg, `fixture.received.length>${before}`);
      result.spoofedSender = await read(bg, 'fixture.received.at(-1)');
      assert.equal(result.spoofedSender.origin, host);
      assert.equal(result.spoofedSender.internal, false);
      const count = await read(bg, 'fixture.received.length');
      await read(
        hostPage,
        `fixtureInjected.sendPayload({id:99002,type:'REQUEST',origin:${javascriptLiteral(origin)},internal:true,data:{method:'ping'}})`,
      );
      await wait(
        bg,
        "fixture.rejected.some(e=>e.message.includes('[payload.scope]'))",
      );
      assert.equal(await read(bg, 'fixture.received.length'), count);
      result.unscoped = await read(bg, 'fixture.rejected');
      result.contexts = await read(bg, 'chrome.runtime.getContexts({})');
      assert.equal(
        result.contexts.filter((c) => c.contextType === 'OFFSCREEN_DOCUMENT')
          .length,
        1,
      );
      assert.ok(
        result.observers
          .filter((e) => e.type === 'observer')
          .every((e) => e.installedBeforeLockdown),
      );
      assert.ok(!result.observers.some((e) => e.type === 'rejection'));
      const allowedErrors = [
        'Error: JsBridge ERROR: receive message [payload.scope] is required for non-internal method call.',
        ...(!bgGrant
          ? [
              'Error: JsBridge ERROR: receive message [payload.origin] is required.',
            ]
          : []),
      ];
      assert.deepEqual(
        result.errors.filter(
          (error) =>
            !allowedErrors.some((message) =>
              error.message
                .replace(/^Error in event handler: /, '')
                .startsWith(message),
            ),
        ),
        [],
      );
      result.status = 'passed';
    } catch (error) {
      result.failure = error.stack;
      result.status = 'failed';
      result.diagnostic = [];
      for (const { session, label } of diagnosticSessions) {
        try {
          const r = await session.send('Runtime.evaluate', {
            expression:
              '({href:globalThis.location?.href,fixtureType:typeof globalThis.fixture,fixture:globalThis.fixture,ready:globalThis.document?.readyState,harden:typeof harden})',
            returnByValue: true,
          });
          result.diagnostic.push({
            label,
            value: r.result?.value,
            error: r.exceptionDetails?.text,
          });
        } catch {
          // The original failure remains authoritative if its context closed.
        }
      }
      throw error;
    } finally {
      const cleanup = await Promise.allSettled([
        browser?.close(),
        (async () => {
          if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
          }
        })(),
      ]);
      for (const entry of cleanup) {
        if (entry.status === 'rejected') cleanupFailure ||= entry.reason;
      }
      if (cleanupFailure) result.cleanupError = String(cleanupFailure);
      fs.writeFileSync(
        path.join(directory, 'report.json'),
        JSON.stringify(result, null, 2),
      );
      proof.runs.push(result);
      fs.writeFileSync(
        path.join(root, 'runtime-proof.json'),
        JSON.stringify(proof, null, 2),
      );
    }
    if (cleanupFailure) {
      const cleanupError = new LavaMoatError(
        'SDK bridge fixture cleanup failed',
      );
      cleanupError.cause = cleanupFailure;
      throw cleanupError;
    }
  }

  try {
    for (const role of ['background', 'pages', 'content']) {
      await compile(role, true, false);
      setPolicy(role, false);
      await compile(role, false, false);
      if (role !== 'content') {
        setPolicy(role, true);
        await compile(role, false, true);
      }
    }
    await compile('injected', false, false);
    await run('both-granted', true, true);
    await run('background-missing', false, true);
    // Native sender metadata lets these paths work without a pages grant.
    // Keep this contrast so graph presence cannot justify extra permissions.
    await run('pages-missing', true, false);
    for (const [file, originalHash] of Object.entries(proof.sourceHashes)) {
      assert.equal(
        sha(installed(file)),
        originalHash,
        'SDK source changed during verification',
      );
    }
  } finally {
    if (previous === undefined) delete process.env.ONEKEY_LAVAMOAT;
    else process.env.ONEKEY_LAVAMOAT = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
