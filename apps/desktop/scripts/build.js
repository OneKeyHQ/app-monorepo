const path = require('path');
const childProcess = require('child_process');
const { build } = require('esbuild');
const pkg = require('../package.json');

const electronSource = path.join(__dirname, '..', 'src-electron');

const gitRevision = childProcess
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

const hrstart = process.hrtime();
build({
  entryPoints: ['app.ts', 'preload.ts'].map((f) =>
    path.join(electronSource, f),
  ),
  platform: 'node',
  bundle: true,
  target: 'node16',
  external: Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }),
  tsconfig: path.join(electronSource, 'tsconfig.json'),
  outdir: path.join(__dirname, '..', 'dist'),
  define: {
    'process.env.COMMITHASH': JSON.stringify(gitRevision),
  },
})
  .then(() => {
    const hrend = process.hrtime(hrstart);
    console.log(
      '[Electron Build] Finished in %dms',
      (hrend[1] / 1000000 + hrend[0] * 1000).toFixed(1),
    );
  })
  .catch(() => process.exit(1));
