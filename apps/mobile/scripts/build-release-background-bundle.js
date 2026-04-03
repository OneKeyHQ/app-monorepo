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
