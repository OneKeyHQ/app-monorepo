/* eslint-disable onekey/no-raw-error -- standalone synthetic storage verification */
// Run from app-monorepo after rebuilding the installed Zcash WASM packages:
// node packages/core/src/chains/zcash/sdkZcash/scripts/verify-opfs-storage.cjs
// Add --url-worker to verify external Worker/WASM assets used by desktop/web.
// Uses a new Electron profile for every case; never opens an App wallet.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { rspack } = require('@rspack/core');

async function main() {
  const inlineWorker = !process.argv.includes('--url-worker');
  const root = path.resolve(__dirname, '../../../../../../..');
  const parent = path.join(root, '.tmp');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'zcash-opfs-'));
  const runtime = require.resolve('onekey-zcash-runtime', {
    paths: [path.join(root, 'packages/core')],
  });
  const compiler = rspack({
    mode: 'production',
    target: 'web',
    context: path.join(__dirname, 'opfs-probe'),
    entry: './page.js',
    output: { path: directory, filename: 'probe.js', publicPath: '' },
    resolve: {
      extensions: ['.js'],
      alias: {
        'onekey-zcash-runtime': runtime,
        'onekey-zcash-benchmark': path.join(
          path.dirname(runtime),
          'storage-benchmark/onekey_zcash_storage_benchmark.js',
        ),
      },
    },
    optimization: { splitChunks: false, minimize: false },
    performance: false,
    plugins: inlineWorker
      ? [
          new rspack.NormalModuleReplacementPlugin(
            /worker-rspack-loader[\\/]dist[\\/]runtime[\\/]inline\.js$/,
            path.join(__dirname, '../sdk/inlineWorkerRuntime.js'),
          ),
        ]
      : [],
    module: {
      rules: [
        {
          test: /\.wasm$/,
          type: inlineWorker ? 'asset/inline' : 'asset/resource',
        },
        {
          test: /\.worker\.js$/,
          use: {
            loader: require.resolve('worker-rspack-loader'),
            options: inlineWorker ? { inline: 'no-fallback' } : {},
          },
        },
      ],
    },
  });
  await new Promise((resolve, reject) =>
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError || stats?.hasErrors())
          reject(
            error ||
              closeError ||
              new Error(stats.toString({ all: false, errors: true })),
          );
        else resolve();
      });
    }),
  );
  fs.writeFileSync(
    path.join(directory, 'index.html'),
    '<!doctype html><script src="probe.js"></script>',
  );
  for (const mode of [
    'recovery',
    'metadata',
    'shortWrite',
    'runtimeFault',
    'handoff',
  ]) {
    const result = spawnSync(
      require('electron'),
      [path.join(__dirname, 'opfs-probe/electron.cjs'), directory, mode],
      { encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
    if (result.error) throw result.error;
    process.stdout.write(result.stdout);
    if (result.status !== 0)
      throw new Error(`${mode} failed: ${result.stderr}`);
  }
  console.log(
    `Verified OPFS recovery, fault handling and owner handoff. Artifacts: ${directory}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
