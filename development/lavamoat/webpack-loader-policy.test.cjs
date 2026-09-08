// cspell:ignore LavaMoat lavamoat cssData matchResource tamagui

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const webpack = require('webpack');

const { LavaMoatError } = require('./error.cjs');

const { isExcluded } = require(
  path.join(path.dirname(LavaMoatPlugin.exclude), 'buildtime/exclude.js'),
);

const repoRoot = path.resolve(__dirname, '../..');

function writeJson(filename, value) {
  fs.writeFileSync(filename, JSON.stringify(value));
}

function makeDependency(directory, name, source, dependencies = {}) {
  const dependency = path.join(directory, 'node_modules', name);
  fs.mkdirSync(dependency, { recursive: true });
  writeJson(path.join(dependency, 'package.json'), {
    name,
    version: '1.0.0',
    main: 'index.js',
    dependencies,
  });
  fs.writeFileSync(path.join(dependency, 'index.js'), source);
  return dependency;
}

async function compile(directory, generatePolicyOnly) {
  const observedModules = [];
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry: './index.js',
    output: {
      path: path.join(directory, generatePolicyOnly ? 'generate' : 'enforce'),
      filename: 'main.js',
    },
    optimization: { minimize: false },
    resolveLoader: { modules: [path.join(repoRoot, 'node_modules')] },
    module: {
      rules: [
        { test: /\.woff2$/, type: 'asset/inline' },
        {
          test: /\.css$/,
          use: [
            LavaMoatPlugin.exclude,
            require.resolve('style-loader'),
            require.resolve('css-loader'),
          ],
        },
      ],
    },
    plugins: [
      {
        apply(compilerInstance) {
          compilerInstance.hooks.compilation.tap(
            'ObserveLavaMoatCssFixture',
            (compilation) => {
              compilation.hooks.finishModules.tap(
                'ObserveLavaMoatCssFixture',
                (modules) => {
                  for (const module of modules) {
                    if (
                      Array.isArray(module.loaders) &&
                      typeof module.rawRequest === 'string'
                    ) {
                      observedModules.push({
                        resource: module.resource,
                        matchResource: module.matchResource,
                        rawRequest: module.rawRequest,
                        excluded: isExcluded(module),
                      });
                    }
                  }
                },
              );
            },
          );
        },
      },
      new LavaMoatPlugin({
        rootDir: directory,
        policyLocation: path.join(directory, 'policy'),
        generatePolicyOnly,
        inlineLockdown: /^main\.js$/,
      }),
    ],
  });
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
    assert.equal(
      stats.hasErrors(),
      false,
      stats.toString({ all: false, errors: true }),
    );
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
  return observedModules;
}

test('Tamagui virtual CSS generates an enforceable policy without trusting inline exclude loaders', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-loader-policy-')),
  );
  try {
    const loaderDependencies = {};
    fs.mkdirSync(path.join(directory, 'node_modules'));
    for (const name of ['style-loader', 'css-loader']) {
      const manifest = require.resolve(`${name}/package.json`);
      loaderDependencies[name] = JSON.parse(
        fs.readFileSync(manifest, 'utf8'),
      ).version;
      fs.symlinkSync(
        path.dirname(manifest),
        path.join(directory, 'node_modules', name),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    writeJson(path.join(directory, 'package.json'), {
      name: 'loader-policy-fixture-root',
      private: true,
      dependencies: {
        ...loaderDependencies,
        'fixture-widget': '1.0.0',
        'fixture-attacker': '1.0.0',
      },
    });

    const widget = makeDependency(
      directory,
      'fixture-widget',
      '',
      loaderDependencies,
    );
    const source = path.join(widget, 'source.ts');
    fs.writeFileSync(
      source,
      'throw new Error("The underlying TypeScript resource must never execute as CSS");',
    );
    const tamaguiCssLoader = path.join(
      path.dirname(require.resolve('tamagui-loader/package.json')),
      'dist/cjs/css.cjs',
    );
    const cssSources = ['.first { color: red; }', '.second { color: blue; }'];
    const cssRequests = cssSources.map((css, index) => {
      // Use Tamagui's real CSS loader and matchResource request format. The
      // virtual path is deliberately outside the dependency: package ownership
      // must follow the resolved resource, while each loader request stays unique.
      const virtualCss = path.join(directory, `source.ts.${index}.tamagui.css`);
      return `${virtualCss}!=!${tamaguiCssLoader}?cssData=${Buffer.from(css).toString('base64')}!${source}`;
    });
    fs.writeFileSync(path.join(widget, 'fixture-font.woff2'), 'fixture font');
    fs.writeFileSync(
      path.join(widget, 'font.css'),
      '@font-face { font-family: FixtureFont; src: url("./fixture-font.woff2"); }',
    );
    fs.writeFileSync(
      path.join(widget, 'index.js'),
      `${cssRequests.map((request) => `require(${JSON.stringify(request)});`).join('\n')}\nrequire('./font.css');\nmodule.exports = typeof fetch;`,
    );

    const attacker = makeDependency(
      directory,
      'fixture-attacker',
      `module.exports = require(${JSON.stringify(`!${LavaMoatPlugin.exclude}!./payload.js`)});`,
    );
    fs.writeFileSync(
      path.join(attacker, 'payload.js'),
      `module.exports = () => ({
        fetchType: typeof fetch,
        secretType: typeof hostSecret,
        prototypeMutable: Reflect.set(Object.prototype, "cssPolicyPolluted", true),
      });`,
    );
    fs.writeFileSync(
      path.join(directory, 'normal.css'),
      '.ordinary { color: green; }',
    );
    fs.writeFileSync(
      path.join(directory, 'index.js'),
      `require('./normal.css');
       fixtureResults.widgetFetchType = require('fixture-widget');
       fixtureResults.attacker = require('fixture-attacker')();`,
    );

    const generatedModules = await compile(directory, true);
    assert.equal(
      fs.existsSync(path.join(directory, 'generate/main.js')),
      false,
      'policy-only generation must not emit a deployable entry bundle',
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy/policy.json'), 'utf8'),
    );
    assert.equal(
      policy.resources['fixture-widget'].packages['css-loader'],
      true,
    );
    assert.equal(
      policy.resources['fixture-widget'].packages['style-loader'],
      true,
      'the wrapped virtual CSS must grant its actual runtime imports',
    );
    assert.equal(
      policy.resources['fixture-widget'].globals.URL,
      true,
      'CSS loader-generated JavaScript must be inspected even when its resource ends in .css',
    );
    assert.equal(policy.resources['fixture-attacker'].globals.fetch, true);
    assert.equal(
      policy.resources['fixture-attacker'].globals.hostSecret,
      true,
      'inline exclude must not suppress policy inspection',
    );
    writeJson(path.join(directory, 'policy/policy-override.json'), {
      resources: {
        'fixture-widget': { globals: { fetch: false } },
        'fixture-attacker': { globals: { fetch: false, hostSecret: false } },
      },
    });
    const enforcedModules = await compile(directory, false);
    for (const modules of [generatedModules, enforcedModules]) {
      assert.equal(
        modules.find((module) => module.rawRequest === './normal.css').excluded,
        true,
        'ordinary CSS explicitly excluded by config keeps its existing behavior',
      );
      const virtualModules = modules.filter((module) =>
        module.matchResource?.endsWith('.tamagui.css'),
      );
      assert.equal(virtualModules.length, cssSources.length);
      for (const module of virtualModules) {
        assert.equal(module.resource, source);
        assert.equal(module.excluded, false);
      }
      assert.equal(
        modules.find((module) => module.rawRequest.includes('!./payload.js'))
          .excluded,
        false,
        'a dependency cannot request trusted execution with an inline loader',
      );
    }

    const context = vm.createContext({
      console,
      URL,
      fixtureResults: {},
      hostSecret: 'fixture host capability',
      fetch() {
        throw new LavaMoatError(
          'The host fetch capability must remain inaccessible',
        );
      },
    });
    vm.runInContext(
      `globalThis.self = globalThis;
       globalThis.window = globalThis;
       globalThis.fixtureStyles = [];
       globalThis.document = {
         baseURI: 'https://fixture.invalid/',
         querySelector() { return { appendChild(element) { fixtureStyles.push(element); } }; },
         createElement() { return { styleSheet: { cssText: '' } }; },
       };`,
      context,
    );
    vm.runInContext(
      fs.readFileSync(path.join(directory, 'enforce/main.js'), 'utf8'),
      context,
    );
    const renderedCss = Array.from(
      context.fixtureStyles,
      (element) => element.styleSheet.cssText,
    );
    assert.deepEqual(renderedCss.slice(0, 3), [
      '.ordinary { color: green; }',
      ...cssSources,
    ]);
    assert.equal(renderedCss.length, 4);
    assert.match(renderedCss[3], /src: url\(data:font\/woff2;base64,/);
    assert.equal(context.fixtureResults.widgetFetchType, 'undefined');
    assert.equal(context.fixtureResults.attacker.fetchType, 'undefined');
    assert.equal(context.fixtureResults.attacker.secretType, 'undefined');
    assert.equal(context.fixtureResults.attacker.prototypeMutable, false);
    assert.equal(
      vm.runInContext('Object.prototype.cssPolicyPolluted', context),
      undefined,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
