// cspell:ignore LavaMoat lavamoat matchResource

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const { chromium } = require('playwright-core');
const webpack = require('webpack');

const protectedSesLoader = require('../webpack/lavamoat-web-ses-loader.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const fallback = path.join(
  repoRoot,
  'packages/shared/src/security/sesHarden/loadSes.ts',
);
const translations = path.join(
  repoRoot,
  'packages/shared/src/locale/enum/translations.ts',
);
const inlinePlugin = require.resolve('../babel-plugins/inline-translations');
const loaderPath = require.resolve('../webpack/lavamoat-web-ses-loader.cjs');

function inspectRules(config, file, matchResource = file) {
  const NormalModuleFactory = require('webpack/lib/NormalModuleFactory');
  const ResolverFactory = require('webpack/lib/ResolverFactory');
  const factory = new NormalModuleFactory({
    context: config.context,
    fs,
    resolverFactory: new ResolverFactory(),
    options: { ...config.module, defaultRules: [] },
    associatedObjectForCache: {},
  });
  return factory.ruleSet.exec({
    resource: matchResource,
    realResource: file,
    resourceQuery: '',
    resourceFragment: '',
    issuer: path.join(config.context, 'index.js'),
    dependency: 'esm',
  });
}

function firstPartyBabel(config) {
  const matches = inspectRules(config, fallback).filter(
    (effect) =>
      effect.type === 'use' && effect.value?.loader === 'babel-loader',
  );
  assert.equal(matches.length, 1);
  return matches[0].value;
}

function transformedFallback(
  overrides = {},
  source = fs.readFileSync(fallback, 'utf8'),
) {
  const dependencies = [];
  const output = protectedSesLoader.call(
    {
      resourcePath: fallback,
      resourceQuery: '',
      resourceFragment: '',
      _module: { rawRequest: fallback },
      addDependency(file) {
        dependencies.push(file);
      },
      ...overrides,
    },
    source,
  );
  assert.deepEqual(dependencies, [fallback]);
  return output;
}

test('protected Web transforms only its physical unchanged SES fallback and rejects an absent or unlocked prelude', () => {
  const original = fs.readFileSync(fallback, 'utf8');
  const transformed = transformedFallback();
  assert.ok(!transformed.includes("require('ses')"));
  for (const overrides of [
    { resourcePath: translations },
    { resourceQuery: '?untrusted' },
    { resourceFragment: '#untrusted' },
    { _module: { rawRequest: `other-loader!${fallback}` } },
    { _module: { rawRequest: fallback, matchResource: 'other.ts' } },
    { _module: undefined },
  ]) {
    assert.throws(
      () => transformedFallback(overrides),
      /unchanged physical SES fallback/,
    );
  }
  assert.throws(
    () => transformedFallback({}, `${original}\nvoid 1;`),
    /unchanged physical SES fallback/,
  );
  const rule = protectedSesLoader.createProtectedWebSesRule();
  assert.equal(rule.realResource(fallback), true);
  assert.equal(rule.realResource(translations), false);
  assert.equal(rule.enforce, 'pre');

  const context = vm.createContext({});
  const invocation = `${transformed.replace('export default ', '')}\nloadSes();`;
  assert.throws(
    () => vm.runInContext(invocation, context),
    /existing LavaMoat SES prelude/,
  );
  const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
  vm.runInContext(
    fs.readFileSync(pluginRequire.resolve('ses'), 'utf8'),
    context,
  );
  assert.throws(
    () => vm.runInContext(invocation, context),
    /existing LavaMoat SES prelude/,
  );
  vm.runInContext(
    "lockdown({ errorTrapping: 'none', reporting: 'none' });",
    context,
  );
  vm.runInContext(invocation, context);
  vm.runInContext(
    `new Compartment().evaluate(${JSON.stringify(invocation)});`,
    context,
  );
  assert.equal(Object.isFrozen(Object.prototype), false);
  assert.equal(Object.isFrozen(Function.prototype), false);
});

test('real config factories keep startup optimizations exclusive to protected production Web', () => {
  const inspect = () => {
    const scenarioAssert = require('node:assert/strict');
    const scenarioPath = require('node:path');
    const scenarioFs = require('node:fs');
    const NormalModuleFactory = require('webpack/lib/NormalModuleFactory');
    const ResolverFactory = require('webpack/lib/ResolverFactory');
    const root = process.cwd();
    const source = scenarioPath.join(
      root,
      'packages/shared/src/security/sesHarden/loadSes.ts',
    );
    const plugin =
      require.resolve('./development/babel-plugins/inline-translations');
    const loader =
      require.resolve('./development/webpack/lavamoat-web-ses-loader.cjs');
    const protectedProduction =
      process.env.NODE_ENV === 'production' &&
      (process.env.ONEKEY_LAVAMOAT === '1' ||
        process.env.ONEKEY_LAVAMOAT_GENERATE_POLICY === '1');
    for (const target of ['web', 'desktop', 'web-embed']) {
      const factory = require(
        `./development/webpack/webpack.${target}.config.js`,
      );
      const basePath = scenarioPath.join(root, 'apps', target);
      if (target === 'web-embed' && !protectedProduction) {
        scenarioAssert.throws(
          () => factory({ basePath }),
          /requires production LavaMoat/,
        );
      } else {
        const config = factory({ basePath });
        const moduleFactory = new NormalModuleFactory({
          context: config.context,
          fs: scenarioFs,
          resolverFactory: new ResolverFactory(),
          options: { ...config.module, defaultRules: [] },
          associatedObjectForCache: {},
        });
        const effectsFor = (realResource, resource = realResource) =>
          moduleFactory.ruleSet.exec({
            resource,
            realResource,
            resourceQuery: '',
            resourceFragment: '',
            issuer: scenarioPath.join(basePath, 'index.js'),
            dependency: 'esm',
          });
        const effects = effectsFor(source);
        const expected = target === 'web' && protectedProduction ? 1 : 0;
        const lava = config.plugins.find(
          (entry) => entry.constructor.name === 'LavaMoatPlugin',
        );
        if (lava) {
          scenarioAssert.equal(
            lava.options.readableResourceIds,
            !expected,
            target,
          );
        }
        if (process.env.NODE_ENV === 'production' && target !== 'web-embed') {
          const baseline = require('./development/webpack/webpack.prod.config')(
            {
              basePath,
              platform: target,
            },
          ).optimization.splitChunks.cacheGroups;
          const actualGroups = config.optimization.splitChunks.cacheGroups;
          for (const name of ['cryptoVendor', 'networkVendor']) {
            scenarioAssert.equal(
              actualGroups[name].chunks,
              expected ? 'initial' : 'all',
            );
            scenarioAssert.deepEqual(
              { ...actualGroups[name], chunks: baseline[name].chunks },
              baseline[name],
              'only the protected Web chunk eligibility may change',
            );
          }
          scenarioAssert.deepEqual(
            actualGroups.lodashVendor,
            baseline.lodashVendor,
          );
          scenarioAssert.deepEqual(
            actualGroups.reactVendor,
            baseline.reactVendor,
          );
        }
        const sesRules = effects.filter(
          (effect) => effect.value?.loader === loader,
        );
        scenarioAssert.equal(sesRules.length, expected, target);
        const translationTransforms = effects.filter((effect) =>
          effect.value?.options?.plugins?.includes(plugin),
        );
        scenarioAssert.equal(translationTransforms.length, expected, target);
        if (expected) {
          scenarioAssert.equal(sesRules[0].type, 'use-pre');
          const foreign = scenarioPath.join(
            root,
            'node_modules/untrusted/loadSes.ts',
          );
          scenarioAssert.equal(
            effectsFor(foreign, source).filter(
              (effect) => effect.value?.loader === loader,
            ).length,
            0,
          );
          scenarioAssert.equal(
            effectsFor(foreign, source).filter((effect) =>
              effect.value?.options?.plugins?.includes(plugin),
            ).length,
            1,
            'matchResource can choose ordinary Babel transforms but not replace a physical SES source',
          );
          scenarioAssert.equal(
            effectsFor(foreign).filter((effect) =>
              effect.value?.options?.plugins?.includes(plugin),
            ).length,
            0,
          );
        }
      }
    }
  };
  for (const [environment, flag, generate] of [
    ['production', '1', ''],
    ['production', '', '1'],
    ['production', '', ''],
    ['development', '1', ''],
    ['development', '', ''],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['-e', `(${inspect.toString()})();`],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: environment,
          ONEKEY_LAVAMOAT: flag,
          ONEKEY_LAVAMOAT_GENERATE_POLICY: generate,
          ENABLE_ANALYZER: '',
          SENTRY_UPLOAD_BY_CLI: 'true',
          NODE_OPTIONS: '--max-old-space-size=2048',
        },
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1_048_576,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
});

function write(directory, file, content) {
  const destination = path.join(directory, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

async function compile(configuration) {
  const compiler = webpack(configuration);
  try {
    const stats = await new Promise((resolve, reject) =>
      compiler.run((error, value) => (error ? reject(error) : resolve(value))),
    );
    assert.equal(
      stats.hasErrors(),
      false,
      stats.toString({ all: false, errors: true }),
    );
    return stats;
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('real protected Web preserves lazy vendors, inline translations, SES, SRI and package isolation', async () => {
  const previous = Object.fromEntries(
    [
      'NODE_ENV',
      'ONEKEY_LAVAMOAT',
      'ONEKEY_LAVAMOAT_GENERATE_POLICY',
      'SENTRY_UPLOAD_BY_CLI',
    ].map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NODE_ENV: 'production',
    ONEKEY_LAVAMOAT: '1',
    ONEKEY_LAVAMOAT_GENERATE_POLICY: '',
    SENTRY_UPLOAD_BY_CLI: 'true',
  });
  const actual = require('../webpack/webpack.web.config')({
    basePath: path.join(repoRoot, 'apps/web'),
  });
  const babel = firstPartyBabel(actual);
  const sesRule = actual.module.rules.find(
    (rule) => Array.isArray(rule.use) && rule.use.includes(loaderPath),
  );
  assert.ok(sesRule);
  assert.deepEqual(babel.options.plugins, [inlinePlugin]);
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-web-startup-fixture-')),
  );
  let browser;
  let server;
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'web-startup-root',
        private: true,
        dependencies: {
          '@onekeyhq/shared': '1.0.0',
          restricted: '1.0.0',
          'bn.js': '1.0.0',
          '@supabase/fixture': '1.0.0',
        },
      }),
    );
    const vendorPayloads = {};
    for (const name of ['bn.js', '@supabase/fixture']) {
      write(
        directory,
        `node_modules/${name}/package.json`,
        JSON.stringify({ name, version: '1.0.0' }),
      );
      for (const part of ['initial', 'lazy']) {
        const value = `${name}-${part}-${'public-fixture-data'.repeat(7000)}`;
        vendorPayloads[`${name}/${part}`] = value;
        write(
          directory,
          `node_modules/${name}/${part}.js`,
          `module.exports = ${JSON.stringify(value)};`,
        );
      }
    }
    fs.mkdirSync(path.join(directory, 'node_modules/@onekeyhq'), {
      recursive: true,
    });
    fs.symlinkSync(
      path.join(repoRoot, 'packages/shared'),
      path.join(directory, 'node_modules/@onekeyhq/shared'),
      'dir',
    );
    write(
      directory,
      'node_modules/restricted/package.json',
      JSON.stringify({
        name: 'restricted',
        version: '1.0.0',
        dependencies: { unapproved: '1.0.0' },
      }),
    );
    write(
      directory,
      'node_modules/unapproved/package.json',
      JSON.stringify({ name: 'unapproved', version: '1.0.0' }),
    );
    write(
      directory,
      'node_modules/unapproved/index.js',
      'module.exports = () => globalThis.fixturePackageMarker;',
    );
    write(
      directory,
      'node_modules/restricted/index.js',
      `module.exports = () => {
      globalThis.fixturePackageMarker = 'restricted-only';
      let denied = false; try { require('unapproved'); } catch (error) { denied = /Policy does not allow importing/.test(error.message); }
      return { denied, fetch: typeof fetch, secret: typeof fixtureSecret, mutated: Reflect.set(Object.prototype, '__webStartupMutation', true) };
    };`,
    );
    write(
      directory,
      'index.ts',
      `import loadSes from ${JSON.stringify(fallback)};
      import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
      import { ETranslations as Alias } from '@onekeyhq/shared/src/locale/enum/translations';
      import restricted from 'restricted';
      import unapproved from 'unapproved';
      import initialCrypto from 'bn.js/initial.js';
      import initialNetwork from '@supabase/fixture/initial.js';
      loadSes();
      Object.assign(fixtureResult, { values: [ETranslations.global_cancel, Alias['global_confirm']], restricted: restricted(),
        neighborMarker: unapproved(), initialVendors: [initialCrypto.length, initialNetwork.length],
        loadLazy: () => import('./lazy').then(module => module.default) });
      document.body.textContent = 'Protected Web fixture ready';`,
    );
    write(
      directory,
      'lazy.ts',
      `import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
      import lazyCrypto from 'bn.js/lazy.js';
      import lazyNetwork from '@supabase/fixture/lazy.js';
      const key = globalThis.translationKey;
      export default { translation: ETranslations[key], vendors: [lazyCrypto.length, lazyNetwork.length] };`,
    );
    const output = path.join(directory, 'dist');
    const makeConfig = (generate, vendorChunks = 'initial') => {
      const lava = actual.plugins.find(
        (plugin) => plugin.constructor.name === 'LavaMoatPlugin',
      );
      const LavaMoatPlugin = require('@lavamoat/webpack');
      return {
        mode: 'production',
        context: directory,
        entry: './index.ts',
        output: {
          path: output,
          filename: '[name].[contenthash:10].bundle.js',
          chunkFilename: '[name].[contenthash:10].chunk.js',
          publicPath: '/',
          crossOriginLoading: actual.output.crossOriginLoading,
          clean: true,
        },
        resolve: {
          ...actual.resolve,
          modules: [
            path.join(directory, 'node_modules'),
            path.join(repoRoot, 'node_modules'),
          ],
          alias: { ...actual.resolve.alias },
        },
        resolveLoader: { modules: [path.join(repoRoot, 'node_modules')] },
        module: {
          rules: [
            {
              test: /\.[jt]sx?$/,
              exclude: /node_modules/,
              use: [
                {
                  ...babel,
                  options: { ...babel.options, cacheDirectory: false },
                },
              ],
            },
            sesRule,
          ],
        },
        optimization: {
          ...actual.optimization,
          splitChunks: {
            ...actual.optimization.splitChunks,
            cacheGroups: {
              ...actual.optimization.splitChunks.cacheGroups,
              cryptoVendor: {
                ...actual.optimization.splitChunks.cacheGroups.cryptoVendor,
                chunks: vendorChunks,
              },
              networkVendor: {
                ...actual.optimization.splitChunks.cacheGroups.networkVendor,
                chunks: vendorChunks,
              },
            },
          },
        },
        plugins: [
          new HtmlWebpackPlugin({
            templateContent:
              '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'"><body></body>',
          }),
          ...actual.plugins.filter(
            (plugin) =>
              plugin.constructor.name === 'SubresourceIntegrityPlugin' ||
              (!generate &&
                plugin.constructor === Object &&
                typeof plugin.apply === 'function' &&
                Object.keys(plugin).length === 1),
          ),
          new LavaMoatPlugin({
            ...lava.options,
            rootDir: directory,
            policyLocation: path.join(directory, 'policy'),
            generatePolicyOnly: generate,
          }),
        ],
      };
    };
    const policyFile = path.join(directory, 'policy/policy.json');
    await compile(makeConfig(true, 'all'));
    const previousGroupingPolicy = JSON.parse(
      fs.readFileSync(policyFile, 'utf8'),
    );
    await compile(makeConfig(true));
    const policySource = fs.readFileSync(policyFile, 'utf8');
    const policy = JSON.parse(policySource);
    assert.deepEqual(
      policy,
      previousGroupingPolicy,
      'chunk placement must not alter generated package permissions',
    );
    const restrictions = policy.resources.restricted;
    write(
      directory,
      'policy/policy-override.json',
      JSON.stringify({
        resources: {
          restricted: {
            globals: Object.fromEntries(
              Object.keys(restrictions.globals || {}).map((key) => [
                key,
                false,
              ]),
            ),
            packages: Object.fromEntries(
              Object.keys(restrictions.packages || {}).map((key) => [
                key,
                false,
              ]),
            ),
          },
        },
      }),
    );
    const stats = await compile(makeConfig(false));
    assert.equal(
      fs.readFileSync(policyFile, 'utf8'),
      policySource,
      'enforcement must consume the generated policy without rewriting it',
    );
    const modules = [...stats.compilation.modules];
    const runtimeModule = modules.find(
      (module) => module.name === 'LavaMoat/runtime',
    );
    assert.ok(runtimeModule);
    const resourceMappingMatch = runtimeModule
      .generate()
      .match(/LAVAMOAT\['idmap'\] = \((.*)\);/);
    assert.ok(resourceMappingMatch);
    const resourceMapping = JSON.parse(resourceMappingMatch[1]);
    assert.ok(resourceMapping.every(([owner]) => /^\d+$/.test(owner)));
    const vendorOwners = new Map();
    for (const name of ['bn.js', '@supabase/fixture']) {
      assert.equal(
        policy.resources[name],
        undefined,
        'literal-only vendors must exercise omitted zero-permission owners',
      );
      for (const part of ['initial', 'lazy']) {
        const module = modules.find(
          (candidate) =>
            candidate.resource ===
            path.join(directory, 'node_modules', name, `${part}.js`),
        );
        assert.ok(module, `${name}/${part} must remain in the compilation`);
        const id = stats.compilation.chunkGraph.getModuleId(module);
        const owner = resourceMapping.find(([, ids]) => ids.includes(id))?.[0];
        assert.ok(owner);
        if (vendorOwners.has(name)) assert.equal(vendorOwners.get(name), owner);
        else vendorOwners.set(name, owner);
        const chunks = [
          ...stats.compilation.chunkGraph.getModuleChunksIterable(module),
        ];
        assert.ok(chunks.length > 0);
        assert.ok(
          chunks.every(
            (chunk) => chunk.canBeInitial() === (part === 'initial'),
          ),
          `${name}/${part} must preserve initial/lazy eligibility`,
        );
      }
    }
    assert.equal(
      new Set(vendorOwners.values()).size,
      2,
      'omitted vendor resources must retain different compartments',
    );
    assert.ok(modules.some((module) => module.resource === fallback));
    assert.ok(
      !modules.some((module) =>
        module.resource?.includes('/node_modules/ses/'),
      ),
    );
    const translationModule = modules.find(
      (module) => module.resource === translations,
    );
    assert.ok(
      translationModule,
      'dynamic enum access must retain the real module',
    );
    assert.ok(
      [
        ...stats.compilation.chunkGraph.getModuleChunksIterable(
          translationModule,
        ),
      ].every((chunk) => !chunk.canBeInitial()),
      'the enum must be lazy when every initial use is static',
    );
    const assets = new Map(
      stats.compilation
        .getAssets()
        .map(({ name }) => [
          `/${name}`,
          fs.readFileSync(path.join(output, name)),
        ]),
    );
    const html = assets.get('/index.html').toString();
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^" ]+)"[^>]*>/g)];
    const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
    const ses = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
    let rawCount = 0;
    for (const [url, bytes] of assets)
      if (url.endsWith('.js')) {
        assert.doesNotThrow(
          () => new vm.Script(bytes.toString(), { filename: url }),
        );
        rawCount += bytes.toString().split(ses).length - 1;
      }
    assert.equal(rawCount, 1);
    assert.ok(scripts[0][1].includes('lavamoat-runtime.'));
    for (const [tag, url] of scripts) {
      const hash = crypto
        .createHash('sha384')
        .update(assets.get(url))
        .digest('base64');
      assert.ok(tag.includes(`integrity="sha384-${hash}"`));
      assert.ok(tag.includes('crossorigin="anonymous"'));
    }
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
      if (pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      const body = assets.get(pathname === '/' ? '/index.html' : pathname);
      response.writeHead(body ? 200 : 404, {
        'content-type': pathname.endsWith('.js')
          ? 'application/javascript; charset=utf-8'
          : 'text/html; charset=utf-8',
      });
      response.end(body || 'Not found');
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    browser = await chromium.launch({
      executablePath: process.env.ONEKEY_LAVAMOAT_TEST_CHROME || undefined,
      headless: true,
    });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      globalThis.fixtureSecret = 'public denied marker';
      globalThis.fixtureResult = {};
      globalThis.translationKey = 'global_cancel';
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.deepEqual(errors, []);
    try {
      await page
        .getByText('Protected Web fixture ready', { exact: true })
        .waitFor();
    } catch (error) {
      assert.fail(`${error.message}\n${errors.join('\n')}`);
    }
    const result = await page.evaluate(async () => ({
      values: fixtureResult.values,
      restricted: fixtureResult.restricted,
      lazy: await fixtureResult.loadLazy(),
      initialVendors: fixtureResult.initialVendors,
      neighborMarker: fixtureResult.neighborMarker,
      frozen: [Object.prototype, Array.prototype, Function.prototype].every(
        Object.isFrozen,
      ),
    }));
    assert.deepEqual(result, {
      values: ['global.cancel', 'global.confirm'],
      restricted: {
        denied: true,
        fetch: 'undefined',
        secret: 'undefined',
        mutated: false,
      },
      lazy: {
        translation: 'global.cancel',
        vendors: [
          vendorPayloads['bn.js/lazy'].length,
          vendorPayloads['@supabase/fixture/lazy'].length,
        ],
      },
      initialVendors: [
        vendorPayloads['bn.js/initial'].length,
        vendorPayloads['@supabase/fixture/initial'].length,
      ],
      neighborMarker: undefined,
      frozen: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    const lazyAsset = [...assets.keys()].find((url) =>
      url.endsWith('.chunk.js'),
    );
    assert.ok(lazyAsset);
    const lazyBytes = assets.get(lazyAsset);
    assets.set(
      lazyAsset,
      Buffer.concat([
        lazyBytes,
        Buffer.from('\nglobalThis.lazyTamperExecuted = true;'),
      ]),
    );
    const badLazyContext = await browser.newContext();
    await badLazyContext.addInitScript(() => {
      globalThis.translationKey = 'global_cancel';
      globalThis.fixtureResult = {};
    });
    const badLazyPage = await badLazyContext.newPage();
    const lazyErrors = [];
    badLazyPage.on('console', (message) => {
      if (message.type() === 'error') lazyErrors.push(message.text());
    });
    await badLazyPage.goto(`http://127.0.0.1:${server.address().port}/`);
    await badLazyPage
      .getByText('Protected Web fixture ready', { exact: true })
      .waitFor();
    await assert.rejects(
      badLazyPage.evaluate(() => fixtureResult.loadLazy()),
      /Loading chunk|ChunkLoadError/,
    );
    assert.equal(
      await badLazyPage.evaluate(() => typeof lazyTamperExecuted),
      'undefined',
    );
    assert.ok(lazyErrors.some((message) => /integrity|digest/i.test(message)));
    await badLazyContext.close();
    assets.set(lazyAsset, lazyBytes);
    const entry = scripts.find(
      ([, url]) => !url.includes('lavamoat-runtime.'),
    )[1];
    assets.set(
      entry,
      Buffer.concat([
        assets.get(entry),
        Buffer.from('\nglobalThis.sriTamperExecuted = true;'),
      ]),
    );
    const negative = await browser.newContext();
    const deniedPage = await negative.newPage();
    const consoleErrors = [];
    deniedPage.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await deniedPage.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(
      await deniedPage.evaluate(() => typeof fixtureResult),
      'undefined',
    );
    assert.equal(
      await deniedPage.evaluate(() => typeof sriTamperExecuted),
      'undefined',
    );
    assert.ok(
      consoleErrors.some((message) => /integrity|digest/i.test(message)),
    );
    await negative.close();
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('ordinary Web still compiles and runs the original lazy SES installer', async () => {
  const previous = Object.fromEntries(
    [
      'NODE_ENV',
      'ONEKEY_LAVAMOAT',
      'ONEKEY_LAVAMOAT_GENERATE_POLICY',
      'SENTRY_UPLOAD_BY_CLI',
    ].map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NODE_ENV: 'production',
    ONEKEY_LAVAMOAT: '',
    ONEKEY_LAVAMOAT_GENERATE_POLICY: '',
    SENTRY_UPLOAD_BY_CLI: 'true',
  });
  const actual = require('../webpack/webpack.web.config')({
    basePath: path.join(repoRoot, 'apps/web'),
  });
  const babel = firstPartyBabel(actual);
  assert.equal(babel.options.plugins, undefined);
  assert.equal(
    inspectRules(actual, fallback).some(
      (effect) => effect.value?.loader === loaderPath,
    ),
    false,
  );
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-web-ses-ordinary-')),
  );
  try {
    write(
      directory,
      'index.ts',
      `import loadSes from ${JSON.stringify(fallback)};
      const before = typeof lockdown;
      loadSes();
      const installed = typeof lockdown === 'function' && !Object.isFrozen(Object.prototype);
      lockdown({ errorTrapping: 'none', reporting: 'none' });
      globalThis.ordinaryResult = { before, installed, frozen: [Object.prototype, Array.prototype, Function.prototype].every(Object.isFrozen) };`,
    );
    const stats = await compile({
      mode: 'production',
      context: directory,
      entry: './index.ts',
      output: { path: path.join(directory, 'dist'), filename: 'main.js' },
      resolve: {
        ...actual.resolve,
        modules: [path.join(repoRoot, 'node_modules')],
      },
      resolveLoader: { modules: [path.join(repoRoot, 'node_modules')] },
      module: {
        rules: [
          {
            test: /\.[jt]sx?$/,
            exclude: /node_modules/,
            use: [
              {
                ...babel,
                options: { ...babel.options, cacheDirectory: false },
              },
            ],
          },
        ],
      },
      optimization: { minimize: false },
    });
    assert.ok(
      [...stats.compilation.modules].some(
        (module) => module.resource === require.resolve('ses'),
      ),
    );
    assert.ok(
      [...stats.compilation.modules].every(
        (module) =>
          !module.loaders?.some((loader) => loader.loader === loaderPath),
      ),
    );
    const context = vm.createContext({});
    vm.runInContext(
      fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8'),
      context,
    );
    assert.deepEqual(
      JSON.parse(vm.runInContext('JSON.stringify(ordinaryResult)', context)),
      { before: 'undefined', installed: true, frozen: true },
    );
    assert.equal(Object.isFrozen(Object.prototype), false);
    assert.equal(Object.isFrozen(Function.prototype), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
