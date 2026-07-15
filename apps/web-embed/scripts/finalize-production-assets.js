/* eslint-disable onekey/no-raw-error */
/* cspell:ignore postbuild */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('../../../development/env');

const buildDir = path.resolve(__dirname, '../web-build');
const browserCompatScript = path.join(__dirname, 'check-browser-compat.js');
const sentryCli = path.resolve(
  __dirname,
  '../../../node_modules/@sentry/cli/bin/sentry-cli',
);
const productionArtifactSuffixes = ['.css.map', '.js.map', '.LICENSE.txt'];

function collectProductionArtifacts(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectProductionArtifacts(entryPath);
      }
      return entry.isFile() &&
        productionArtifactSuffixes.some((suffix) => entry.name.endsWith(suffix))
        ? [entryPath]
        : [];
    });
}

function cleanupProductionAssets(directoryPath) {
  const artifacts = collectProductionArtifacts(directoryPath);
  artifacts.forEach((filePath) => fs.rmSync(filePath, { force: true }));
  return artifacts;
}

function resolveSentryRelease() {
  const appVersion =
    process.env.BUILD_APP_VERSION ||
    process.env.CI_BUILD_APP_VERSION ||
    process.env.VERSION;
  const buildNumber = process.env.BUILD_NUMBER;
  if (appVersion && buildNumber) {
    return `${appVersion} (${buildNumber})`;
  }
  return process.env.SENTRY_RELEASE_NAME || '';
}

function runSentryCli(args, label) {
  const authToken =
    process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_TOKEN || '';
  const result = spawnSync(sentryCli, args, {
    cwd: path.resolve(__dirname, '../../..'),
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_ORG: process.env.SENTRY_ORG || 'onekey-bb',
    },
    stdio: 'inherit',
  });
  if (result.error) {
    console.warn(
      `::warning::Web-embed Sentry ${label} could not start: ${result.error.message}`,
    );
    return false;
  }
  if (result.status !== 0) {
    console.warn(
      `::warning::Web-embed Sentry ${label} exited with status ${result.status}.`,
    );
    return false;
  }
  return true;
}

function uploadSourcemaps() {
  const authToken = process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_TOKEN;
  const project = process.env.SENTRY_PROJECT;
  if (!authToken || !project) {
    console.log(
      'Skipping web-embed Sentry upload because its credentials are unavailable.',
    );
    return;
  }

  const release = resolveSentryRelease();
  const releaseArgs = release ? ['--release', release] : [];
  if (release) {
    runSentryCli(['releases', 'new', release], 'release creation');
  }

  runSentryCli(['sourcemaps', 'inject', buildDir], 'debug-id injection');
  execFileSync(process.execPath, [browserCompatScript], {
    cwd: path.resolve(__dirname, '../../..'),
    stdio: 'inherit',
  });

  const uploaded = runSentryCli(
    [
      'sourcemaps',
      'upload',
      ...releaseArgs,
      '--url-prefix',
      '~/web-embed',
      buildDir,
    ],
    'sourcemap upload',
  );
  if (uploaded && release) {
    runSentryCli(['releases', 'finalize', release], 'release finalization');
  }
}

function finalizeProductionAssets({ stripOnly = false } = {}) {
  const uploadDelegated = process.env.SENTRY_UPLOAD_BY_CLI === 'true';
  if (uploadDelegated && !stripOnly) {
    if (process.env.WEB_EMBED_SKIP_POSTBUILD !== 'true') {
      throw new Error(
        'SENTRY_UPLOAD_BY_CLI=true requires WEB_EMBED_SKIP_POSTBUILD=true so sourcemaps cannot reach native assets before finalization.',
      );
    }
    console.log(
      'Deferring web-embed production finalization to the external Sentry upload owner.',
    );
    return [];
  }

  let uploadError;
  try {
    if (!stripOnly) {
      uploadSourcemaps();
    }
  } catch (error) {
    uploadError = error;
  }

  const removedFiles = cleanupProductionAssets(buildDir);
  const remainingFiles = collectProductionArtifacts(buildDir);
  if (remainingFiles.length > 0) {
    throw new Error(
      `Web-embed production artifacts still contain sourcemaps or license files: ${remainingFiles.join(', ')}`,
    );
  }
  console.log(
    `Finalized web-embed production assets and removed ${removedFiles.length} sourcemap/license files.`,
  );
  if (uploadError !== undefined) {
    const message =
      uploadError instanceof Error ? uploadError.message : String(uploadError);
    throw new Error(`Web-embed production finalization failed: ${message}`, {
      cause: uploadError,
    });
  }
  return removedFiles;
}

function main() {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== '--strip-only');
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown arguments: ${unknownArgs.join(', ')}`);
  }
  finalizeProductionAssets({ stripOnly: args.includes('--strip-only') });
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanupProductionAssets,
  collectProductionArtifacts,
  finalizeProductionAssets,
};
