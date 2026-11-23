const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mobileLockdown = require('../mobileLockdown');

function configure(env) {
  const context = vm.createContext({
    module: { exports: {} },
    __dirname: path.resolve(__dirname, '..'),
    process: { env },
    require(specifier) {
      if (specifier === 'path') return path;
      if (specifier === 'dotenv') return { config() {} };
      if (specifier === './map') return { fileToIdMap: new Map() };
      if (specifier === './mobileLockdown') return mobileLockdown;
      throw new Error(`Legacy split dependency requested: ${specifier}`);
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8'),
    context,
  );
  const config = {
    serializer: { customSerializer: 'default-serializer' },
    transformer: { asyncRequireModulePath: 'default-async-require' },
    server: { enhanceMiddleware: 'default-middleware' },
  };
  return context.module.exports(config, path.resolve(__dirname, '../..'));
}

test.each([
  ['main', 'true'],
  ['main', undefined],
  ['background', 'true'],
  ['background', undefined],
])(
  'protected %s development with flag %s retains the complete Metro graph and async import boundary',
  (runtime, mode) => {
    const config = configure({
      NODE_ENV: 'development',
      SPLIT_BUNDLE: '1',
      METRO_RUNTIME_TARGET: runtime,
      ONEKEY_MOBILE_LOCKDOWN: mode,
    });
    expect(config.serializer.customSerializer).toBe('default-serializer');
    expect(config.transformer.asyncRequireModulePath).toBe(
      path.resolve(__dirname, '../asyncRequireEager.js'),
    );
    expect(config.server.enhanceMiddleware).toBe('default-middleware');
  },
);

test('an unspecified NODE_ENV also avoids the legacy development evaluator', () => {
  expect(
    configure({ SPLIT_BUNDLE: '1' }).transformer.asyncRequireModulePath,
  ).toBe(path.resolve(__dirname, '../asyncRequireEager.js'));
});

test.each([
  { NODE_ENV: 'production', ONEKEY_MOBILE_LOCKDOWN: 'true' },
  { NODE_ENV: 'development', ONEKEY_MOBILE_LOCKDOWN: 'false' },
])('keeps the existing split loader for %j', (env) => {
  expect(() => configure({ ...env, SPLIT_BUNDLE: '1' })).toThrow(
    'Legacy split dependency requested: fs-extra',
  );
});
