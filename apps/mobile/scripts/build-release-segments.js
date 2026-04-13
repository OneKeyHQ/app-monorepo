#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/**
 * Compile segment JS files (produced by Metro's segmentSerializer) to Hermes
 * bytecode. Called by the Gradle build after the main/background bundle tasks
 * to ensure segment .seg.hbc files are available for APK packaging.
 *
 * Usage:
 *   node scripts/build-release-segments.js \
 *     --runtime-target main \
 *     --output-dir /path/to/output/segments
 */

const { execFileSync } = require('child_process');
const path = require('path');

const fs = require('fs-extra');

const { getSegmentsDir } = require('../plugins/segmentPaths');

const projectRootPath = path.resolve(__dirname, '../../..');

const HERMES_PLATFORM_DIR =
  process.platform === 'linux' ? 'linux64-bin' : 'osx-bin';
const HERMES_COMMAND = path.join(
  projectRootPath,
  `node_modules/react-native/sdks/hermesc/${HERMES_PLATFORM_DIR}/hermesc`,
);

const log = (...messages) => {
  console.log(`>>>> [build-segments] ${messages.join(' ')}`);
};

// Parse CLI args
const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const [key, inlineValue] = arg.slice(2).split('=');
  args[key] = inlineValue !== undefined ? inlineValue : process.argv[++i];
}

const runtimeTarget = args['runtime-target'] || 'main';
const outputDir = args['output-dir'];
if (!outputDir) {
  throw new Error('Missing required argument: --output-dir');
}

const segmentsInputDir = getSegmentsDir(runtimeTarget);

if (!fs.existsSync(segmentsInputDir)) {
  log(
    `No segments directory at ${segmentsInputDir} for ${runtimeTarget}, skipping`,
  );
  process.exit(0);
}

const segFiles = fs
  .readdirSync(segmentsInputDir)
  .filter((f) => f.endsWith('.seg.js'));

if (segFiles.length === 0) {
  log(`No .seg.js files found for ${runtimeTarget}, skipping`);
  process.exit(0);
}

fs.ensureDirSync(outputDir);

log(
  `compiling ${segFiles.length} ${runtimeTarget} segment(s) to HBC → ${outputDir}`,
);

for (const segFile of segFiles) {
  const baseName = segFile.replace('.seg.js', '');
  const segJsPath = path.join(segmentsInputDir, segFile);
  const segHbcPath = path.join(outputDir, `${baseName}.seg.hbc`);

  execFileSync(HERMES_COMMAND, ['-O', '-emit-binary', '-out', segHbcPath, segJsPath], {
    stdio: 'inherit',
  });
  log(`  ${baseName} → ${path.basename(segHbcPath)}`);
}

log(`${runtimeTarget} segments compiled`);
