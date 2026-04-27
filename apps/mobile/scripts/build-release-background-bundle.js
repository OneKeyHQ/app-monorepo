#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error, no-continue */

const { execFileSync } = require('child_process');
const path = require('path');

const fs = require('fs-extra');

const mobileDirPath = path.resolve(__dirname, '..');
const projectRootPath = path.resolve(mobileDirPath, '../..');

const HERMES_PLATFORM_DIR =
  process.platform === 'linux' ? 'linux64-bin' : 'osx-bin';
// cspell:ignore hermesc
const HERMES_COMMAND = path.join(
  projectRootPath,
  `node_modules/react-native/sdks/hermesc/${HERMES_PLATFORM_DIR}/hermesc`,
);

const log = (...messages) => {
  console.log(`>>>> [background-bundle] ${messages.join(' ')}`);
};

const ensureAbsolutePath = (targetPath) => {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(mobileDirPath, targetPath);
};

const parseArgs = (argv) => {
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    const currentArg = argv[i];
    if (!currentArg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${currentArg}`);
    }

    const normalizedArg = currentArg.slice(2);
    const [key, inlineValue] = normalizedArg.split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextArg = argv[i + 1];
    if (!nextArg || nextArg.startsWith('--')) {
      throw new Error(`Missing value for argument: --${key}`);
    }

    args[key] = nextArg;
    i += 1;
  }

  return args;
};

const runCommand = (command, args, env) => {
  log('run', command, args.join(' '));
  execFileSync(command, args, {
    cwd: mobileDirPath,
    env,
    stdio: 'inherit',
  });
};

const args = parseArgs(process.argv);

const platform = args.platform;
if (!platform || !['ios', 'android'].includes(platform)) {
  throw new Error('Missing or invalid --platform. Expected ios or android.');
}

const bundleOutputPathArg = args['bundle-output'];
const assetsDestPathArg = args['assets-dest'];
if (!bundleOutputPathArg || !assetsDestPathArg) {
  throw new Error(
    'Missing required arguments: --bundle-output and --assets-dest.',
  );
}

const entryFilePath = ensureAbsolutePath(args['entry-file'] || 'background.ts');
const bundleOutputPath = ensureAbsolutePath(bundleOutputPathArg);
const assetsDestPath = ensureAbsolutePath(assetsDestPathArg);
const sourceMapOutputPath = args['sourcemap-output']
  ? ensureAbsolutePath(args['sourcemap-output'])
  : null;

const bundleBuildEnv = {
  ...process.env,
  NODE_ENV: 'production',
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=8192',
  METRO_RUNTIME_TARGET: 'background',
};

fs.ensureDirSync(path.dirname(bundleOutputPath));
fs.ensureDirSync(assetsDestPath);
if (sourceMapOutputPath) {
  fs.ensureDirSync(path.dirname(sourceMapOutputPath));
}

const packagerSourceMapPath = sourceMapOutputPath
  ? `${sourceMapOutputPath}.packager`
  : null;

const bundleCommandArgs = [
  'react-native',
  'bundle',
  '--dev',
  'false',
  '--minify',
  'false',
  '--platform',
  platform,
  '--entry-file',
  entryFilePath,
  '--reset-cache',
  '--assets-dest',
  assetsDestPath,
  '--bundle-output',
  bundleOutputPath,
];

if (packagerSourceMapPath) {
  bundleCommandArgs.push('--sourcemap-output', packagerSourceMapPath);
}

runCommand('npx', bundleCommandArgs, bundleBuildEnv);

const hermesBytecodeOutputPath = `${bundleOutputPath}.hbc`;
const hermesCommandArgs = ['-O', '-emit-binary'];
if (sourceMapOutputPath) {
  hermesCommandArgs.push('-output-source-map');
}
hermesCommandArgs.push('-out', hermesBytecodeOutputPath, bundleOutputPath);

runCommand(HERMES_COMMAND, hermesCommandArgs, process.env);
fs.moveSync(hermesBytecodeOutputPath, bundleOutputPath, { overwrite: true });

if (sourceMapOutputPath) {
  const compilerSourceMapPath = `${hermesBytecodeOutputPath}.map`;
  const composeSourceMapsPath = path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  );

  runCommand(
    process.execPath,
    [
      composeSourceMapsPath,
      packagerSourceMapPath,
      compilerSourceMapPath,
      '-o',
      sourceMapOutputPath,
    ],
    process.env,
  );

  fs.rmSync(packagerSourceMapPath, { force: true });
  fs.rmSync(compilerSourceMapPath, { force: true });
}

log('bundle generated at', bundleOutputPath);

// ---------------------------------------------------------------------------
// Compile segment files produced by Metro's segmentSerializer to HBC and
// copy them into the assets directory so they ship inside the app bundle.
// This handles BOTH main-runtime and background-runtime segments because the
// background bundle task runs AFTER the main bundle task on every platform.
// ---------------------------------------------------------------------------
const { getSegmentsDir } = require('../plugins/segmentPaths');

// Segments must live alongside the bundle in the assets directory, NOT in
// --assets-dest which on Android points to the res/ (resources) directory.
// res/ requires .xml extensions and would reject .seg.hbc files.
const segmentsBaseDir = path.dirname(bundleOutputPath);

const compileAndCopySegments = (runtimeTarget, outputSubdir) => {
  const segmentsInputDir = getSegmentsDir(runtimeTarget);
  if (!fs.existsSync(segmentsInputDir)) {
    log(`no ${runtimeTarget} segments dir at ${segmentsInputDir}, skipping`);
    return;
  }

  const segFiles = fs
    .readdirSync(segmentsInputDir)
    .filter((f) => f.endsWith('.seg.js'));
  if (segFiles.length === 0) {
    log(`no ${runtimeTarget} .seg.js files, skipping`);
    return;
  }

  const segmentsOutputDir = path.join(segmentsBaseDir, outputSubdir);
  fs.ensureDirSync(segmentsOutputDir);
  log(
    `compiling ${segFiles.length} ${runtimeTarget} segment(s) → ${segmentsOutputDir}`,
  );

  for (const segFile of segFiles) {
    const baseName = segFile.replace('.seg.js', '');
    const segJsPath = path.join(segmentsInputDir, segFile);
    const segHbcPath = path.join(segmentsOutputDir, `${baseName}.seg.hbc`);
    // unionBuild.js now compiles every segment to .seg.hbc right after
    // emission so the manifest's per-segment sha256 can hash the real
    // compiled bytes before the manifest gets baked into common.bundle
    // (required by @onekeyfe/react-native-split-bundle-loader 3.0.23+ which
    // verifies sha256 at segment-load time). Re-running hermesc here would
    // spend minutes re-producing byte-identical output — and any flag drift
    // between this call and unionBuild.js would silently cause a sha256
    // mismatch at runtime. Prefer the pre-built .seg.hbc next to the .seg.js.
    const preBuiltHbcPath = path.join(segmentsInputDir, `${baseName}.seg.hbc`);
    if (fs.existsSync(preBuiltHbcPath)) {
      fs.copyFileSync(preBuiltHbcPath, segHbcPath);
      log(
        `  ${baseName} → ${outputSubdir}/${baseName}.seg.hbc (reused pre-built .seg.hbc)`,
      );
      continue;
    }
    runCommand(
      HERMES_COMMAND,
      ['-O', '-emit-binary', '-out', segHbcPath, segJsPath],
      process.env,
    );
    log(`  ${baseName} → ${outputSubdir}/${baseName}.seg.hbc`);
  }
};

compileAndCopySegments('main', 'segments');
compileAndCopySegments('background', 'segments-background');
