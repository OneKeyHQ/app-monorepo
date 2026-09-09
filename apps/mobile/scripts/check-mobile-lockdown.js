/* eslint-disable onekey/no-raw-error, no-restricted-syntax */
// Node-only verification runs each Metro/VM fixture sequentially to bound memory.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');

const {
  applyMobileLockdownConfig,
  getMobileLockdownE2ERunId,
  isMobileLockdownEnabled,
} = require('../plugins/mobileLockdown');

const mobileRoot = path.resolve(__dirname, '..');
const enabled = isMobileLockdownEnabled();
const e2eRunId = getMobileLockdownE2ERunId();
const config = applyMobileLockdownConfig({
  serializer: { getPolyfills: () => [] },
});
const polyfills = config.serializer.getPolyfills({ platform: 'ios' });
const babelOptions = {
  cwd: mobileRoot,
  configFile: path.join(mobileRoot, 'babel.config.js'),
  babelrc: false,
  caller: { name: 'metro', platform: 'ios', supportsStaticESM: false },
};

for (const filename of polyfills) {
  if (babel.transformFileSync(filename, babelOptions) !== null) {
    throw new Error(`Security polyfill was transformed by Babel: ${filename}`);
  }
}

const helper = babel.transformFileSync(
  path.join(mobileRoot, 'src/security/finishMobileLockdown.ts'),
  babelOptions,
).code;
const compilerPlatform = {
  darwin: 'osx-bin',
  linux: 'linux64-bin',
  win32: 'win64-bin',
}[process.platform];
if (!compilerPlatform)
  throw new Error(`Unsupported compiler platform: ${process.platform}`);
const compiler = path.join(
  path.dirname(require.resolve('hermes-compiler/package.json')),
  'hermesc',
  compilerPlatform,
  process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
);
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'onekey-mobile-lockdown-'),
);

async function main() {
  // Exercise Expo's actual script worker in both modes: its fallback for a null
  // Babel AST used to reload the app config without a filename in dev vendors.
  const metroFactory = require('../metro.config');
  const metroConfig = await (typeof metroFactory === 'function'
    ? metroFactory()
    : metroFactory);
  const worker = require('@expo/metro-config/build/transform-worker/metro-transform-worker');
  for (const dev of [true, false]) {
    const transformedPolyfills = [];
    for (const filename of polyfills) {
      const result = await worker.transform(
        metroConfig.transformer,
        mobileRoot,
        path.relative(mobileRoot, filename),
        fs.readFileSync(filename),
        {
          type: 'script',
          dev,
          hot: dev,
          minify: !dev,
          experimentalImportSupport: false,
          inlineRequires: false,
          platform: 'ios',
          customTransformOptions: { engine: 'hermes' },
        },
      );
      if (result.dependencies.length !== 0)
        throw new Error(
          `Security prelude gained Metro dependencies: ${filename}`,
        );
      transformedPolyfills.push(result.output[0].data.code);
    }
    for (const runtime of ['main', 'background']) {
      const entryName = runtime === 'main' ? 'index.ts' : 'background.ts';
      const entry = await worker.transform(
        metroConfig.transformer,
        mobileRoot,
        entryName,
        fs.readFileSync(path.join(mobileRoot, entryName)),
        {
          type: 'module',
          dev,
          hot: dev,
          minify: !dev,
          experimentalImportSupport: false,
          inlineRequires: false,
          platform: 'ios',
          customTransformOptions: { engine: 'hermes' },
        },
      );
      const probeDependencies = entry.dependencies.filter((dependency) =>
        dependency.name.includes('mobileLockdownReleaseCheck'),
      );
      if (
        !e2eRunId &&
        entry.dependencies.some((dependency) =>
          dependency.name.includes('mobileLockdownWebEmbedReleaseCheck'),
        )
      ) {
        throw new Error(
          `Default artifact contains WebEmbed E2E probe: ${entryName}`,
        );
      }
      if (probeDependencies.length !== (e2eRunId ? 1 : 0)) {
        throw new Error(
          `Unexpected Release E2E probe dependency in ${entryName} dev=${dev}`,
        );
      }
      if (
        !e2eRunId &&
        entry.output[0].data.code.includes('mobileLockdownReleaseCheck')
      ) {
        throw new Error(
          `Default artifact contains Release E2E probe code: ${entryName}`,
        );
      }
      const source = [
        'var console = { log: print, warn: print, error: print };',
        'Object.defineProperty(Error.prototype, "jsEngine", { value: "hermes", configurable: true });',
        ...transformedPolyfills,
        // Model the vetted shim window between repair and hardening.
        'Object.prototype.onekeyLockdownFixture = function () { return 42; };',
        'var exports = {};',
        helper,
        `var state = exports.finishMobileLockdown(${JSON.stringify(runtime)});`,
        `if (state.lockdownApplied !== ${enabled}) throw new Error("Unexpected lockdown state");`,
        `if (Object.isFrozen(Object.prototype) !== ${enabled}) throw new Error("Unexpected intrinsic integrity");`,
        'if (({}).onekeyLockdownFixture() !== 42) throw new Error("Vetted shim was lost");',
        `if (exports.finishMobileLockdown(${JSON.stringify(runtime)}) !== state) throw new Error("Duplicate initialization");`,
        'Promise.resolve(42).then(function (value) { if (value !== 42) throw new Error("Promise failed"); print("MOBILE_LOCKDOWN_PASS"); });',
      ].join('\n');
      const sourcePath = path.join(
        outputDirectory,
        `${runtime}-${dev ? 'debug' : 'release'}.js`,
      );
      const bytecodePath = path.join(
        outputDirectory,
        `${runtime}-${dev ? 'debug' : 'release'}.hbc`,
      );
      fs.writeFileSync(sourcePath, source);
      // The fixture has no process.env, so this also verifies the real mobile Babel
      // configuration inlined the selected mode. This is a Node VM, not Hermes.
      let fixturePassed = false;
      vm.runInNewContext(
        source,
        {
          print(message) {
            if (message === 'MOBILE_LOCKDOWN_PASS') fixturePassed = true;
          },
        },
        { timeout: 5000, microtaskMode: 'afterEvaluate' },
      );
      if (!fixturePassed)
        throw new Error(`Babel runtime fixture failed: ${runtime}`);
      const compiled = spawnSync(
        compiler,
        ['-O', '-emit-binary', `-out=${bytecodePath}`, sourcePath],
        { encoding: 'utf8' },
      );
      if (compiled.status !== 0)
        throw new Error(`Hermes compile failed: ${compiled.stderr}`);
      console.log(
        `[mobile-lockdown] ${runtime} dev=${dev} enabled=${enabled} Hermes compilation passed: ${bytecodePath}`,
      );
    }
  }
  console.log(
    '[mobile-lockdown] Compilation only. Run the app on iOS and Android to validate native runtime behavior.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
