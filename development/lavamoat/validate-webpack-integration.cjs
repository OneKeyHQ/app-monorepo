const path = require('path');
const { spawnSync } = require('child_process');

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
    throw new Error(
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
    throw new Error(message);
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
assert(!loaded, '@lavamoat/webpack should not load without LavaMoat env');
assert(!lavaMoatPlugin(configs.web), 'web config should not include LavaMoatPlugin without LavaMoat env');
assert(!lavaMoatPlugin(configs.desktop), 'desktop config should not include LavaMoatPlugin without LavaMoat env');
assertNoLavaMoatExcludeRules(configs.web, 'web config');
assertNoLavaMoatExcludeRules(configs.desktop, 'desktop config');
`,
);

runScenario(
  'production config with LavaMoat enforcement',
  { ONEKEY_LAVAMOAT: '1' },
  `
${commonSetup}
const configs = loadConfigs();
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
`,
);

runScenario(
  'production config with LavaMoat policy generation',
  { ONEKEY_LAVAMOAT_GENERATE_POLICY: '1' },
  `
${commonSetup}
const configs = loadConfigs();
const webPlugin = lavaMoatPlugin(configs.web);
const desktopPlugin = lavaMoatPlugin(configs.desktop);
assert(webPlugin?.options.generatePolicyOnly === true, 'web should generate policy only');
assert(
  desktopPlugin?.options.generatePolicyOnly === true,
  'desktop renderer should generate policy only',
);
`,
);

console.log('LavaMoat webpack integration validated.');
