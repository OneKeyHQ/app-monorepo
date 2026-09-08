// cspell:ignore LavaMoat LAVAMOAT lavamoat

const { spawnSync } = require('child_process');
const path = require('path');

const { LavaMoatError } = require('./error.cjs');

const repoRoot = path.resolve(__dirname, '../..');

function runScenario(label, env, body) {
  const result = spawnSync(process.execPath, ['-e', body], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ONEKEY_LAVAMOAT: '',
      ONEKEY_LAVAMOAT_GENERATE_POLICY: '',
      ...env,
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new LavaMoatError(
      [
        `${label} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

const commonSetup = `
const path = require('path');
const repoRoot = process.cwd();
class LavaMoatScenarioError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LavaMoatScenarioError';
  }
}
function loadConfigs() {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const webConfigFactory = require('./development/webpack/webpack.web.config.js');
    const desktopConfigFactory = require('./development/webpack/webpack.desktop.config.js');
    return {
      web: webConfigFactory({ basePath: path.join(repoRoot, 'apps/web') }),
      desktop: desktopConfigFactory({ basePath: path.join(repoRoot, 'apps/desktop') }),
    };
  } finally {
    console.log = originalLog;
  }
}
function lavaMoatPlugin(config) {
  return (config.plugins || []).find((plugin) => plugin?.constructor?.name === 'LavaMoatPlugin');
}
function assertWebReleasePlugins(config, enabled) {
  const names = config.plugins.map((plugin) => plugin.constructor.name);
  for (const name of ['WebAppVersionManifestPlugin', 'InjectManifest']) {
    assert(names.includes(name) === enabled, name + ' must run only when building deployable assets');
  }
  assert(names.includes('SubresourceIntegrityPlugin'), 'web must retain subresource integrity');
}
function ruleUses(config, predicate) {
  return (config.module?.rules || []).filter((rule) => predicate(rule));
}
function usesLavaMoatExcludeLoader(rule) {
  const uses = Array.isArray(rule.use) ? rule.use : [rule.use].filter(Boolean);
  return uses.some((item) => String(item).includes('@lavamoat/webpack/src/excludeLoader.js'));
}
function assertLavaMoatExcludeRules(config, label) {
  const cssRules = ruleUses(config, (rule) => String(rule.test) === '/\\\\.css$/');
  const sesRules = ruleUses(config, (rule) =>
    String(rule.test).includes('node_modules') && String(rule.test).includes('ses')
  );
  assert(
    cssRules.some(usesLavaMoatExcludeLoader),
    label + ' should exclude CSS resources from LavaMoat policy',
  );
  assert(
    sesRules.some(usesLavaMoatExcludeLoader),
    label + ' should exclude SES resources from LavaMoat policy',
  );
}
function assertNoLavaMoatExcludeRules(config, label) {
  const rules = config.module?.rules || [];
  assert(
    !rules.some(usesLavaMoatExcludeLoader),
    label + ' should not include LavaMoat exclude loader without LavaMoat env',
  );
}
function assert(condition, message) {
  if (!condition) {
    throw new LavaMoatScenarioError(message);
  }
}
`;

runScenario(
  'production config without LavaMoat env',
  {},
  `
${commonSetup}
const Module = require('module');
const originalLoad = Module._load;
let loaded = false;
Module._load = function(request, parent, isMain) {
  if (request === '@lavamoat/webpack') {
    loaded = true;
  }
  return originalLoad.apply(this, arguments);
};
const configs = loadConfigs();
assertWebReleasePlugins(configs.web, true);
assert(!loaded, '@lavamoat/webpack should not load without LavaMoat env');
assert(!lavaMoatPlugin(configs.web), 'web config should not include LavaMoatPlugin without LavaMoat env');
assert(!lavaMoatPlugin(configs.desktop), 'desktop config should not include LavaMoatPlugin without LavaMoat env');
assertNoLavaMoatExcludeRules(configs.web, 'web config');
assertNoLavaMoatExcludeRules(configs.desktop, 'desktop config');
assert(!configs.web.optimization.runtimeChunk && !configs.desktop.optimization.runtimeChunk, 'normal builds retain their existing runtime placement');
assert(configs.web.optimization.minimize && configs.desktop.optimization.minimize, 'normal production builds must remain minified');
`,
);

runScenario(
  'production config with LavaMoat enforcement',
  { ONEKEY_LAVAMOAT: '1' },
  `
${commonSetup}
const configs = loadConfigs();
assertWebReleasePlugins(configs.web, true);
const webPlugin = lavaMoatPlugin(configs.web);
const desktopPlugin = lavaMoatPlugin(configs.desktop);
assert(webPlugin, 'web config should include LavaMoatPlugin when LavaMoat is enabled');
assert(desktopPlugin, 'desktop config should include LavaMoatPlugin when LavaMoat is enabled');
assert(
  webPlugin.options.policyLocation === path.join(repoRoot, 'lavamoat/webpack/web'),
  'web policyLocation mismatch',
);
assert(
  desktopPlugin.options.policyLocation === path.join(repoRoot, 'lavamoat/webpack/desktop-renderer'),
  'desktop renderer policyLocation mismatch',
);
assert(webPlugin.options.rootDir === path.join(repoRoot, 'apps/web'), 'web rootDir mismatch');
assert(
  desktopPlugin.options.rootDir === path.join(repoRoot, 'apps/desktop'),
  'desktop renderer rootDir mismatch',
);
assert(webPlugin.options.generatePolicyOnly === false, 'web should enforce policy by default');
assert(
  desktopPlugin.options.generatePolicyOnly === false,
  'desktop renderer should enforce policy by default',
);
assertLavaMoatExcludeRules(configs.web, 'web config');
assertLavaMoatExcludeRules(configs.desktop, 'desktop config');
assert(configs.web.optimization.minimize && configs.desktop.optimization.minimize, 'protected production builds must remain minified');
for (const config of [configs.web, configs.desktop]) {
  assert(config.optimization.runtimeChunk.name === 'lavamoat-runtime', 'protected builds need one dedicated runtime immune to maxSize splitting');
}
for (const plugin of [webPlugin, desktopPlugin]) {
  assert(plugin.options.inlineLockdown.test('lavamoat-runtime.012345abcd.bundle.js'), 'SES must be inlined in the runtime entry');
  assert(!plugin.options.inlineLockdown.test('vendor-react.012345abcd.bundle.js'), 'SES must not run again in vendor chunks');
}
`,
);

runScenario(
  'production config with LavaMoat policy generation',
  { ONEKEY_LAVAMOAT_GENERATE_POLICY: '1' },
  `
${commonSetup}
const configs = loadConfigs();
assertWebReleasePlugins(configs.web, false);
const webPlugin = lavaMoatPlugin(configs.web);
const desktopPlugin = lavaMoatPlugin(configs.desktop);
assert(webPlugin?.options.generatePolicyOnly === true, 'web should generate policy only');
assert(
  desktopPlugin?.options.generatePolicyOnly === true,
  'desktop renderer should generate policy only',
);
for (const config of Object.values(configs)) {
  assert(config.optimization.minimize === false && config.devtool === false, 'policy generation must skip minification and source maps');
}
`,
);

runScenario(
  'minified production runtime enforces policy with inline SES',
  { ONEKEY_LAVAMOAT: '1' },
  `
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const { createLavaMoatWebpackOptimization, createLavaMoatWebpackPlugin } = require('./development/webpack/lavamoat');
const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-runtime-')));
async function main() {
  const dependency = path.join(directory, 'node_modules/runtime-fixture');
  fs.mkdirSync(dependency, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'runtime-fixture-root', private: true, dependencies: { 'runtime-fixture': '1.0.0' } }));
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name: 'runtime-fixture', version: '1.0.0', main: 'index.js' }));
  fs.writeFileSync(path.join(dependency, 'index.js'), 'module.exports = () => ({ fetchType: typeof fetch, secretType: typeof hostSecret, mutated: Reflect.set(Object.prototype, "polluted", true) });');
  fs.writeFileSync(path.join(directory, 'index.js'), 'Object.assign(globalThis.fixtureResult, require("runtime-fixture")());');
  fs.writeFileSync(path.join(directory, 'policy.json'), JSON.stringify({ resources: { 'runtime-fixture': {} } }));
  const plugin = createLavaMoatWebpackPlugin({ basePath: directory, target: 'web' });
  plugin.options.policyLocation = directory;
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry: './index.js',
    output: { path: path.join(directory, 'dist'), filename: '[name].[contenthash:10].bundle.js', publicPath: '/', crossOriginLoading: 'anonymous' },
    optimization: createLavaMoatWebpackOptimization(),
    plugins: [new HtmlWebpackPlugin(), new SubresourceIntegrityPlugin(), plugin],
  });
  let stats;
  try {
    stats = await new Promise((resolve, reject) => compiler.run((error, result) => error ? reject(error) : resolve(result)));
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => error ? reject(error) : resolve()));
  }
  assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  const output = path.join(directory, 'dist');
  const files = fs.readdirSync(output);
  const entries = files.filter((file) => plugin.options.inlineLockdown.test(file));
  assert.equal(entries.length, 1, 'exactly one runtime entry must contain SES');
  assert.equal(files.includes('lockdown'), false, 'no separate relative lockdown request');
  const source = fs.readFileSync(path.join(output, entries[0]), 'utf8');
  const sesRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const sesSource = fs.readFileSync(sesRequire.resolve('ses'), 'utf8');
  assert.equal(source.split(sesSource).length, 2, 'SES must remain untransformed and appear exactly once after minification');
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /integrity="sha384-[^"]+"/);
  assert.ok(html.includes('src="/' + entries[0] + '"'), 'entry must resolve from nested routes');
  for (const legacy of [false, true]) {
    const context = vm.createContext({ console, fixtureResult: {}, fetch() { throw new Error('host fetch must be inaccessible'); }, hostSecret: 'private host capability' });
    vm.runInContext('globalThis.self = globalThis;', context);
    if (legacy) {
      // Model the older Chromium baseline: SES captures flatMap/fromEntries
      // during loading, while newer array methods still need app shims.
      vm.runInContext('for (const method of ["at", "toSorted", "toReversed"]) delete Array.prototype[method];', context);
    }
    for (const match of html.matchAll(/src="\\/([^"]+\\.js)"/g)) {
      vm.runInContext(fs.readFileSync(path.join(output, match[1]), 'utf8'), context, { timeout: 10000 });
    }
    assert.deepEqual(JSON.parse(JSON.stringify(context.fixtureResult)), { fetchType: 'undefined', secretType: 'undefined', mutated: false });
    assert.equal(vm.runInContext('[Object.prototype, Array.prototype, Promise, Symbol].every(Object.isFrozen)', context), true);
    assert.equal(vm.runInContext('typeof Symbol.metadata', context), 'symbol');
    assert.equal(vm.runInContext('JSON.stringify([1,2].flatMap(x => [x,x]))', context), '[1,1,2,2]');
    assert.equal(vm.runInContext('[1,2].at(-1)', context), 2);
    assert.equal(vm.runInContext('JSON.stringify([2,1].toSorted())', context), '[1,2]');
    assert.equal(vm.runInContext('JSON.stringify([1,2].toReversed())', context), '[2,1]');
    assert.equal(vm.runInContext('"aba".replaceAll("a", "x")', context), 'xbx');
    assert.equal(vm.runInContext('Object.fromEntries([["ok", 42]]).ok', context), 42);
    const settled = await vm.runInContext('Promise.allSettled([Promise.resolve(42), Promise.reject("expected")])', context);
    assert.deepEqual(JSON.parse(JSON.stringify(settled)), [{ status: 'fulfilled', value: 42 }, { status: 'rejected', reason: 'expected' }]);
    // The app also imports this entry after hardening; its shims must be idempotent.
    vm.runInContext(fs.readFileSync(plugin.options.staticShims_experimental[0], 'utf8'), context);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(directory, { recursive: true, force: true }));
`,
);

console.log('LavaMoat webpack integration validated.');
