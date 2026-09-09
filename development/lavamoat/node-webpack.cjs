// cspell:ignore LavaMoat lavamoat

const fs = require('node:fs');
const { createRequire, isBuiltin } = require('node:module');
const path = require('node:path');

const LavaMoatPlugin = require('@lavamoat/webpack');
const webpack = require('webpack');
const { parseResource } = require('webpack/lib/util/identifier');

const { LavaMoatError } = require('./error.cjs');

const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
const aaRequire = createRequire(
  pluginRequire.resolve('@lavamoat/aa/package.json'),
);
const nodeResolve = aaRequire('resolve');

const states = new Map();
let nextState = 0;
const namespaceParameter = '__onekeyNodeBuildNamespace';

function matches(options, args) {
  options.filter.lastIndex = 0;
  return (
    (!options.namespace || options.namespace === args.namespace) &&
    options.filter.test(args.path)
  );
}

function shimRequestKey({ importer, resolveDir, path: request }) {
  return JSON.stringify([importer, resolveDir, request]);
}

function selectsTrustedNamespace(request) {
  return (
    request.includes(namespaceParameter) ||
    request.split('!').some((segment) => {
      // Use Webpack's own query/fragment parsing, then the loader's exact query
      // decoding. A percent-encoded key must not select a privileged build shim.
      const { query } = parseResource(segment);
      return new URLSearchParams(query.slice(1)).has(namespaceParameter);
    })
  );
}

function getNodeBuildState(id) {
  const state = states.get(id);
  if (!state) throw new LavaMoatError('Missing protected Node build state');
  return state;
}

function createNodeWebpackConfiguration({
  buildOptions,
  esbuildPath = createRequire(
    path.resolve(__dirname, '../../apps/cli/package.json'),
  ).resolve('esbuild'),
  context,
  entry,
  filename,
  runtimeFilenames = [filename],
  outputPath,
  policyLocation,
  target = 'node',
  generatePolicy = false,
  external = buildOptions.external ?? [],
  nativeModules = [],
}) {
  if (
    !generatePolicy &&
    !fs.existsSync(path.join(policyLocation, 'policy.json'))
  ) {
    throw new LavaMoatError(
      `Generate and review the Node policy before building: ${policyLocation}`,
    );
  }
  nextState += 1;
  const id = nextState;
  const nativeRequests = new Set();
  const nativeFiles = new Map();
  for (const nativeModule of nativeModules) {
    if (
      !path.isAbsolute(nativeModule.file) ||
      !/^[a-zA-Z0-9@_][a-zA-Z0-9@_./-]*$/.test(nativeModule.request)
    ) {
      throw new LavaMoatError(
        'Native boundaries require an absolute file and a stable package subpath',
      );
    }
    const file = fs.realpathSync(nativeModule.file);
    if (nativeFiles.has(file))
      throw new LavaMoatError(`Duplicate native boundary: ${file}`);
    nativeFiles.set(file, nativeModule.request);
    nativeRequests.add(nativeModule.request);
  }
  const state = {
    buildOptions,
    esbuildPath,
    loads: [],
    resolves: [],
    shimRequests: new Set(),
    nativeFiles,
  };
  for (const plugin of buildOptions.plugins ?? []) {
    plugin.setup({
      initialOptions: buildOptions,
      onLoad: (options, callback) => state.loads.push({ options, callback }),
      onResolve: (options, callback) =>
        state.resolves.push({ options, callback }),
    });
  }
  states.set(id, state);
  const namespacePlugin = {
    apply(compiler) {
      compiler.hooks.normalModuleFactory.tap('OneKeyNodeBuild', (factory) => {
        factory.hooks.beforeResolve.tapPromise(
          'OneKeyNodeBuild',
          async (data) => {
            if (!data) return;
            if (selectsTrustedNamespace(data.request)) {
              throw new LavaMoatError(
                'Source modules cannot select trusted build shims',
              );
            }
            const args = {
              path: data.request,
              importer: data.contextInfo.issuer || '',
              resolveDir: data.context,
              namespace: 'file',
              kind:
                data.dependencyType === 'commonjs'
                  ? 'require-call'
                  : 'import-statement',
            };
            for (const { options, callback } of state.resolves) {
              const result = matches(options, args)
                ? await callback(args)
                : undefined;
              if (result) {
                if (
                  result.external ||
                  result.errors?.length ||
                  !result.namespace ||
                  !result.path
                ) {
                  throw new LavaMoatError(
                    `Unsupported build shim resolution from ${args.path}`,
                  );
                }
                state.shimRequests.add(shimRequestKey(args));
                // A trailing parameter keeps package-main extension resolution out of the namespace value.
                data.request = `${result.path}?${namespaceParameter}=${encodeURIComponent(result.namespace)}&`;
                break;
              }
            }
          },
        );
      });
      compiler.hooks.shutdown.tap('OneKeyNodeBuild', () => states.delete(id));
    },
  };
  const rawSes = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
  const escapedFilenames = runtimeFilenames
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const plugin = new LavaMoatPlugin({
    policyLocation,
    canonicalNameMapResolve: nodeResolve,
    generatePolicyOnly: generatePolicy,
    isBuiltin: (specifier) =>
      typeof specifier === 'string' &&
      (isBuiltin(specifier) ||
        specifier === 'electron' ||
        nativeRequests.has(specifier) ||
        external.some(
          (name) => specifier === name || specifier.startsWith(`${name}/`),
        )),
    inlineLockdown: new RegExp(`^(?:${escapedFilenames})$`),
  });
  const guard = {
    apply(compiler) {
      compiler.hooks.afterCompile.tap('OneKeyNodeLockdown', (compilation) => {
        if (generatePolicy) return;
        const chunks = [...compilation.chunks].filter((chunk) =>
          chunk.hasRuntime(),
        );
        const actualFilenames = chunks.flatMap((chunk) => [...chunk.files]);
        const sourceIsValid = (name) => {
          const source = compilation.getAsset(name)?.source.source().toString();
          return (
            source &&
            source.split(rawSes).length === 2 &&
            source.includes('_LM_')
          );
        };
        if (
          chunks.length !== runtimeFilenames.length ||
          actualFilenames.length !== runtimeFilenames.length ||
          runtimeFilenames.some(
            (name) => !actualFilenames.includes(name) || !sourceIsValid(name),
          )
        ) {
          compilation.errors.push(
            new webpack.WebpackError(
              'Each protected Node entry must contain exactly one untouched SES runtime',
            ),
          );
        }
      });
    },
  };
  const banner = [
    target !== 'electron-preload' &&
      'if (typeof __dirname === "string") Object.defineProperty(globalThis, "__dirname", { value: __dirname, configurable: true });',
    target !== 'electron-preload' &&
      'if (typeof __filename === "string") Object.defineProperty(globalThis, "__filename", { value: __filename, configurable: true });',
    buildOptions.banner?.js?.replace(/^#![^\n]*\n?/, ''),
  ]
    .filter(Boolean)
    .join('\n');
  const plugins = [
    namespacePlugin,
    // Existing CJS and signed SEA packaging expect self-contained entries.
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: runtimeFilenames.length,
    }),
    plugin,
    guard,
  ];
  if (banner)
    plugins.push(
      new webpack.BannerPlugin({ banner, raw: true, entryOnly: true }),
    );
  return {
    mode: 'production',
    target,
    context,
    entry,
    output: {
      path: outputPath,
      filename,
      library: { type: 'commonjs2' },
      publicPath: '',
      // Match Node's CJS retry behavior. A caught failed native import must not
      // leave partial exports cached for the next platform fallback attempt.
      strictModuleExceptionHandling: true,
    },
    devtool: false,
    node: { __dirname: false, __filename: false },
    optimization: {
      minimize: false,
      concatenateModules: false,
      splitChunks: false,
      runtimeChunk: false,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
      alias: buildOptions.alias,
      mainFields: ['main', 'module'],
    },
    externals: [
      ({ request, context: resolveDir, contextInfo }, callback) => {
        if (
          state.shimRequests.has(
            shimRequestKey({
              path: request,
              resolveDir,
              importer: contextInfo.issuer || '',
            }),
          )
        ) {
          callback();
          return;
        }
        const name = external.find(
          (candidate) =>
            request === candidate || request?.startsWith(`${candidate}/`),
        );
        if (name || nativeRequests.has(request))
          callback(null, `commonjs ${request}`);
        else callback();
      },
    ],
    module: {
      rules: [
        {
          test: (resource) =>
            /\.(?:[cm]?[jt]sx?|json|text-js)$/.test(resource) ||
            nativeFiles.has(resource),
          type: 'javascript/auto',
          use: [
            {
              loader: path.join(__dirname, 'node-webpack-loader.cjs'),
              options: { stateId: id },
            },
          ],
        },
      ],
    },
    plugins,
  };
}

async function compileNodeWebpack(configuration) {
  const compiler = webpack(configuration);
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
    if (stats.hasErrors())
      throw new LavaMoatError(
        stats.toString({ all: false, errors: true, errorDetails: true }),
      );
    return stats;
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

module.exports = {
  createNodeWebpackConfiguration,
  compileNodeWebpack,
  getNodeBuildState,
  matches,
  namespaceParameter,
};
