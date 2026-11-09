import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  compileSource,
  generateOutputs,
  loadTools,
  writeOutputs,
} from './generate-icons.mjs';

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const tools = loadTools(appRoot);
const svg = (body, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attributes}>${body}</svg>`;

test('all canonical names and sprite symbols retain complete source semantics', async () => {
  const { outputs, count, diagnostics } = await generateOutputs(appRoot);
  const svgRoot = path.join(appRoot, 'packages/components/svg');
  const sources = fs
    .readdirSync(svgRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      fs
        .readdirSync(path.join(svgRoot, entry.name))
        .filter((name) => name.endsWith('.svg'))
        .map((name) => `${entry.name}/${name}`),
    );
  assert.ok(
    count >= 1909,
    'The migration must retain the full original icon library',
  );
  assert.equal(count, sources.length);
  assert.equal(outputs.size, 2 * sources.length + 2);
  assert.deepEqual(diagnostics, [
    {
      name: 'GooglePayIllus',
      source: 'illus/google-pay.svg',
      missingReferences: ['clip0_22357_29550'],
    },
  ]);
  const get = (suffix) =>
    [...outputs].find(([file]) => file.endsWith(suffix))[1];
  const manifest = JSON.parse(get('/manifest.json'));
  assert.deepEqual(
    Object.values(manifest)
      .map((entry) => entry.source)
      .toSorted(),
    sources.toSorted(),
  );
  const existingNames = [
    ...fs
      .readFileSync(
        path.join(appRoot, 'packages/components/src/primitives/Icon/Icons.tsx'),
        'utf8',
      )
      .matchAll(/^\s*([A-Z][A-Za-z0-9]*)\s*:\s*'\1',/gm),
  ]
    .map((match) => match[1])
    .toSorted();
  assert.deepEqual(Object.keys(manifest).toSorted(), existingNames);
  for (const name of Object.keys(manifest)) {
    const resource = tools.parse(get(`/web/assets/${name}.svg`));
    const root = resource.children.find((node) => node.type === 'element');
    assert.equal(root.name, 'svg');
    assert.equal(root.children.length, 1);
    const symbol = root.children[0];
    assert.equal(symbol.name, 'symbol');
    assert.equal(symbol.attributes.id, `onekey-${name}`);
    assert.ok(
      ['fixed', 'single', 'multiple', 'raster'].includes(
        manifest[name].recolorMode,
      ),
    );
    assert.equal(
      manifest[name].digest,
      createHash('sha256')
        .update(get(`/native/icons/${name}.svg`))
        .digest('hex'),
    );
    assert.deepEqual(
      symbol.attributes.viewBox.trim().split(/[ ,]+/).map(Number),
      manifest[name].viewBox,
    );
    assert.ok(symbol.children.length);
    assert.equal(
      get(`/native/icons/${name}.svg`),
      fs
        .readFileSync(
          path.join(appRoot, 'packages/components/svg', manifest[name].source),
          'utf8',
        )
        .replace(/\n?$/, '\n'),
    );
  }
});

test('namespace references and reject unsafe/unsupported input without inventing geometry', () => {
  const body =
    '<defs><linearGradient id="paint"><stop stop-color="#0f0"/></linearGradient></defs><path fill="url(#paint)" d="M0 0h24v24z"/><g clip-path="url(#missing)"><circle fill="currentColor" r="2"/></g>';
  const icon = compileSource(svg(body), 'Probe', tools);
  assert.match(icon.symbol, /id="onekey-Probe-paint"/);
  assert.match(icon.symbol, /url\(#onekey-Probe-paint\)/);
  assert.match(icon.symbol, /url\(#onekey-Probe-missing\)/);
  assert.deepEqual(icon.missingReferences, ['missing']);
  assert.match(icon.raw, /url\(#missing\)/);
  for (const input of [
    svg('<image href="https://example.com/a.svg"/>'),
    svg('<script/>'),
    `<?xml-stylesheet href="https://example.com/a.css"?>${svg('<path/>')}`,
    `<!DOCTYPE svg SYSTEM "https://example.com/a.dtd">${svg('<path/>')}`,
    svg('<unknown/>'),
    svg('<path fill="URL(#paint)"/>'),
    svg('<path fill="url( #paint )"/>'),
    svg('<path style="fill:currentColor"/>'),
    svg('<path opacity="currentColor"/>'),
    svg('<path fill="url(https://example.com/a)"/>'),
    svg('<path/>', 'onload="alert(1)"'),
    svg('<path/>').replace('http://www.w3.org/2000/svg', 'wrong'),
  ]) {
    assert.throws(() => compileSource(input, 'Unsafe', tools));
  }
  assert.doesNotThrow(() =>
    compileSource(
      svg('<path/>').replace(' xmlns="http://www.w3.org/2000/svg"', ''),
      'MissingNamespace',
      tools,
    ),
  );
});

test('idempotent read-only check detects stale and extra resources with no partial output', async () => {
  const tempRoot = path.join(appRoot, '.tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(tempRoot, 'onekey-icons-'));
  try {
    const first = await generateOutputs(appRoot, root);
    assert.equal(writeOutputs(first.outputs), first.outputs.size);
    assert.equal(
      writeOutputs((await generateOutputs(appRoot, root)).outputs),
      0,
    );
    const snapshots = new Map(
      [...first.outputs.keys()].map((file) => [
        file,
        { data: fs.readFileSync(file), mtime: fs.statSync(file).mtimeMs },
      ]),
    );
    assert.equal(writeOutputs(first.outputs, true), 0);
    for (const [file, before] of snapshots) {
      assert.deepEqual(fs.readFileSync(file), before.data);
      assert.equal(fs.statSync(file).mtimeMs, before.mtime);
    }
    const fixtureApp = path.join(root, 'fixture-app');
    const fixtureComponents = path.join(fixtureApp, 'packages/components');
    fs.mkdirSync(fixtureComponents, { recursive: true });
    fs.copyFileSync(
      path.join(appRoot, 'packages/components/package.json'),
      path.join(fixtureComponents, 'package.json'),
    );
    fs.symlinkSync(
      path.join(appRoot, 'node_modules'),
      path.join(fixtureApp, 'node_modules'),
      'dir',
    );
    fs.cpSync(
      path.join(appRoot, 'packages/components/svg'),
      path.join(fixtureComponents, 'svg'),
      { recursive: true },
    );
    const manifest = JSON.parse(
      [...first.outputs].find(([file]) => file.endsWith('/manifest.json'))[1],
    );
    const names = Object.keys(manifest);
    const early = path.join(
      fixtureComponents,
      'svg',
      manifest[names[0]].source,
    );
    fs.writeFileSync(
      early,
      fs.readFileSync(early, 'utf8').replaceAll('currentColor', '#123456'),
    );
    const late = path.join(
      fixtureComponents,
      'svg',
      manifest[names.at(-1)].source,
    );
    fs.writeFileSync(late, '<svg><broken');
    await assert.rejects(async () =>
      writeOutputs((await generateOutputs(fixtureApp, root)).outputs),
    );
    for (const [file, before] of snapshots) {
      assert.deepEqual(fs.readFileSync(file), before.data);
      assert.equal(fs.statSync(file).mtimeMs, before.mtime);
    }
    const stale = path.join(root, 'native/icons/Unexpected.svg');
    fs.writeFileSync(stale, '<svg/>');
    assert.throws(() => writeOutputs(first.outputs, true), /Unexpected/);
    fs.unlinkSync(stale);
    const file = [...first.outputs.keys()][0];
    fs.writeFileSync(file, 'stale');
    assert.throws(() => writeOutputs(first.outputs, true), /stale/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'stale');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('recolor classification proves paint semantics and otherwise stays raster', () => {
  const mode = (body, attributes = '') =>
    compileSource(svg(body, attributes), 'Paint', tools).recolorMode;
  assert.equal(mode('<path fill="currentColor" d="M0 0h24v24z"/>'), 'single');
  assert.equal(
    mode('<g fill="currentColor"><path d="M0 0h24v24z"/></g>'),
    'single',
  );
  assert.equal(
    mode('<path fill="currentColor" stroke="currentColor" d="M0 0h24v24z"/>'),
    'multiple',
  );
  assert.equal(
    mode(
      '<path fill="currentColor" d="M0 0h16v24z"/><path fill="currentColor" d="M8 0h16v24z"/>',
    ),
    'multiple',
  );
  assert.equal(mode('<path stroke="currentColor" d="M0 0h24v24z"/>'), 'raster'); // Default fill is visible black.
  assert.equal(
    mode('<path fill="none" stroke="currentColor" d="M0 0h24v24z"/>'),
    'single',
  );
  assert.equal(
    mode('<path fill="currentColor" fill-opacity="0.447" d="M0 0h24v24z"/>'),
    'single',
  );
  assert.equal(
    mode('<path fill="currentColor" opacity="0"/><path fill="#123456"/>'),
    'fixed',
  );
  assert.equal(
    mode('<path fill="currentColor"/><path fill="#fff"/>'),
    'raster',
  );
  for (const keyword of [
    'INHERIT',
    'unset',
    'initial',
    'revert',
    'revert-layer',
    'context-fill',
    'var(--paint)',
  ]) {
    assert.equal(
      mode(`<g fill="currentColor"><path fill="${keyword}"/></g>`),
      'raster',
    );
  }
  assert.equal(mode('<defs/><path fill="currentColor"/>'), 'raster');
  assert.equal(
    mode('<g clip-path="url(#missing)"><path fill="currentColor"/></g>'),
    'raster',
  );
  assert.equal(
    mode('<path fill="currentColor" vector-effect="non-scaling-stroke"/>'),
    'raster',
  );
  assert.equal(
    mode('<defs><linearGradient id="paint"/></defs><path fill="url(#paint)"/>'),
    'fixed',
  );
});

test('reconciles removed resources and concurrent builds outside packaged directories', async () => {
  const root = fs.mkdtempSync(
    path.join(appRoot, '.tmp/onekey-icons-concurrent-'),
  );
  try {
    const directory = path.join(root, 'OneKeyIcons.bundle');
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'RemovedOutline.svg'), '<svg/>');
    const outputs = new Map([
      [path.join(directory, 'manifest.json'), '{}\n'],
      [path.join(directory, 'NewOutline.svg'), '<svg/>'],
    ]);
    assert.throws(() => writeOutputs(outputs, true), /RemovedOutline/);
    writeOutputs(outputs, false, root);
    assert.deepEqual(fs.readdirSync(directory).toSorted(), [
      'NewOutline.svg',
      'manifest.json',
    ]);
    fs.writeFileSync(path.join(directory, 'unowned.txt'), 'retain');
    assert.throws(() => writeOutputs(outputs, false, root), /unowned/);
    assert.equal(
      fs.readFileSync(path.join(directory, 'unowned.txt'), 'utf8'),
      'retain',
    );
    fs.unlinkSync(path.join(directory, 'unowned.txt'));
    const run = () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            path.join(appRoot, 'development/onekey-icons/generate-icons.mjs'),
            '--output-root',
            root,
          ],
          { stdio: 'pipe' },
        );
        let error = '';
        child.stderr.on('data', (data) => {
          error += data;
        });
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(error)),
        );
      });
    await Promise.all([run(), run()]);
    const expected = await generateOutputs(appRoot, root);
    assert.equal(writeOutputs(expected.outputs, true), 0);
    assert.equal(
      fs.readdirSync(path.join(root, 'native/icons')).length,
      expected.count + 1,
    );
    assert.equal(
      fs.readdirSync(path.join(root, 'web/assets')).length,
      expected.count,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the consumed NativeList source contract is covered by the App canonical library', async () => {
  const appRequire = createRequire(path.join(appRoot, 'package.json'));
  const metadataPath = process.env.ONEKEY_ICON_TEST_NATIVE_LIST_PACKAGE
    ? path.join(
        process.env.ONEKEY_ICON_TEST_NATIVE_LIST_PACKAGE,
        'scripts/native-list-icons.json',
      )
    : path.join(
        path.dirname(
          appRequire.resolve('@onekeyfe/react-native-native-list/package.json'),
        ),
        'scripts/native-list-icons.json',
      );
  const contract = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const { outputs } = await generateOutputs(appRoot);
  const manifest = JSON.parse(
    [...outputs].find(([file]) => file.endsWith('/manifest.json'))[1],
  );
  const sources = new Set(Object.values(manifest).map((entry) => entry.source));
  for (const entry of contract) {
    if (entry.name !== 'Circle')
      assert.ok(
        sources.has(entry.source),
        `${entry.name}: missing canonical source ${entry.source}`,
      );
  }
});

test('mobile consumers and Metro bundle registry do not duplicate canonical SVGs', async () => {
  const { outputs } = await generateOutputs(appRoot);
  const manifest = JSON.parse(
    [...outputs].find(([file]) => file.endsWith('/manifest.json'))[1],
  );

  // 1. All native tab icons, sideAccessory icon, and watermark icon exist in the canonical manifest
  const requiredConsumerIcons = [
    'Wallet4Solid',
    'Wallet4Outline',
    'SwitchHorSolid',
    'SwitchHorOutline',
    'CompassSolid',
    'CompassOutline',
    'TradingViewCandlesSolid',
    'TradingViewCandlesOutline',
    'TradeSolid',
    'TradeOutline',
    'CoinsSolid',
    'CoinsOutline',
    'CodeBracketsSolid',
    'CodeBracketsOutline',
    'HelpSupportOutline',
    'LogoIllus',
  ];
  for (const iconName of requiredConsumerIcons) {
    assert.ok(
      manifest[iconName],
      `Missing canonical manifest entry for mobile consumer icon: ${iconName}`,
    );
  }

  // 2. Mobile source files do not require('@onekeyhq/components/svg/...')
  const mobileConsumerFiles = [
    'packages/kit/src/routes/Tab/router.ts',
    'packages/kit/src/routes/Tab/Navigator.tsx',
    'packages/kit/src/components/TradingView/TradingViewNative/native/TradingViewNativeChart.tsx',
  ];
  for (const relPath of mobileConsumerFiles) {
    const content = fs.readFileSync(path.join(appRoot, relPath), 'utf8');
    assert.doesNotMatch(
      content,
      /@onekeyhq\/components\/svg\//,
      `${relPath} must not require canonical SVG sources via Metro`,
    );
  }

  // 3. module-id-registry.json gains no packages/components/svg/ entries. The
  // registry is append-only (removed IDs would be reallocated and `reconcile`
  // rejects removals), so the pre-migration Metro entries stay reserved.
  const registryPath = path.join(
    appRoot,
    'apps/mobile/bundle-registry/module-id-registry.json',
  );
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const legacySvgRegistryEntries = new Set([
    'packages/components/svg/illus/logo.svg',
    ...[
      'code-brackets',
      'coins',
      'compass',
      'switch-hor',
      'trade',
      'trading-view-candles',
      'wallet-4',
    ].flatMap((name) => [
      `packages/components/svg/outline/${name}.svg`,
      `packages/components/svg/solid/${name}.svg`,
    ]),
    'packages/components/svg/outline/help-support.svg',
  ]);
  const svgRegistryEntries = Object.keys(registry.modules || {}).filter(
    (key) =>
      key.startsWith('packages/components/svg/') &&
      !legacySvgRegistryEntries.has(key),
  );
  assert.deepEqual(svgRegistryEntries, []);

  // 4. Metro config enforces policy rejecting @onekeyhq/components/svg/* imports
  const metroConfigContent = fs.readFileSync(
    path.join(appRoot, 'apps/mobile/metro.config.js'),
    'utf8',
  );
  assert.match(
    metroConfigContent,
    /Direct Metro import of canonical SVG source is forbidden/,
  );
});

test('web assetUrls provider uses external href on same-origin and injects in-document symbol on cross-origin CDN', async () => {
  const { outputs } = await generateOutputs(appRoot);
  const assetUrlsTs = [...outputs].find(([file]) =>
    file.endsWith('/web/assetUrls.ts'),
  )[1];
  const dotVerSvg = [...outputs].find(([file]) =>
    file.endsWith('/web/assets/DotVerSolid.svg'),
  )[1];

  const appRequire = createRequire(path.join(appRoot, 'package.json'));
  const { JSDOM } = appRequire('jsdom');
  const { transformSync } = appRequire('@swc/core');

  const evaluateProvider = (baseUrl, contextGlobals) => {
    const rewrittenTs = assetUrlsTs.replaceAll(
      'import.meta.url',
      JSON.stringify(baseUrl),
    );
    const transpiled = transformSync(rewrittenTs, {
      filename: 'assetUrls.ts',
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2020',
      },
      module: { type: 'commonjs' },
    }).code;
    const exportsObj = {};
    vm.runInNewContext(transpiled, {
      exports: exportsObj,
      URL,
      Map,
      Array,
      Object,
      Error,
      document: contextGlobals.document,
      location: contextGlobals.location,
      DOMParser: contextGlobals.DOMParser,
      fetch: contextGlobals.fetch,
    });
    return exportsObj;
  };

  // 1. Same-origin Web environment keeps direct external symbol URL reference
  const sameOriginDom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://app.onekey.so/swap',
  });
  const sameOriginFetchCalls = [];
  const sameOriginProvider = evaluateProvider(
    'https://app.onekey.so/static/js/bundle.js',
    {
      document: sameOriginDom.window.document,
      location: sameOriginDom.window.location,
      DOMParser: sameOriginDom.window.DOMParser,
      fetch: async (url) => {
        sameOriginFetchCalls.push(url);
        return { ok: true, text: async () => dotVerSvg };
      },
    },
  );
  assert.equal(
    sameOriginProvider.iconResourceHref('DotVerSolid'),
    'https://app.onekey.so/static/js/assets/DotVerSolid.svg#onekey-DotVerSolid',
  );
  assert.equal(sameOriginFetchCalls.length, 0);

  // 2. Cross-origin CDN deployment (PUBLIC_URL on app-assets.onekey.so, page on app.onekey.so)
  // fetches symbol once, injects into #onekey-icon-sprite-root, and returns in-document #onekey-<Name>
  const crossOriginDom = new JSDOM(
    '<!doctype html><html><body><svg><use href="#onekey-DotVerSolid"></use></svg></body></html>',
    { url: 'https://app.onekey.so/swap' },
  );
  const crossOriginFetchCalls = [];
  const crossOriginProvider = evaluateProvider(
    'https://app-assets.onekey.so/commit-build/static/js/bundle.js',
    {
      document: crossOriginDom.window.document,
      location: crossOriginDom.window.location,
      DOMParser: crossOriginDom.window.DOMParser,
      fetch: async (url) => {
        crossOriginFetchCalls.push(url);
        return { ok: true, text: async () => dotVerSvg };
      },
    },
  );
  assert.equal(
    crossOriginProvider.iconResourceHref('DotVerSolid'),
    '#onekey-DotVerSolid',
  );
  // Deduplicates concurrent/repeated lookups
  assert.equal(
    crossOriginProvider.iconResourceHref('DotVerSolid'),
    '#onekey-DotVerSolid',
  );
  assert.deepEqual(crossOriginFetchCalls, [
    'https://app-assets.onekey.so/commit-build/static/js/assets/DotVerSolid.svg',
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const injectedSymbol =
    crossOriginDom.window.document.getElementById('onekey-DotVerSolid');
  assert.ok(
    injectedSymbol,
    'Expected cross-origin symbol to be injected into document',
  );
  assert.equal(injectedSymbol.tagName.toLowerCase(), 'symbol');
  assert.equal(
    injectedSymbol.parentElement?.getAttribute('id'),
    'onekey-icon-sprite-root',
  );
});
