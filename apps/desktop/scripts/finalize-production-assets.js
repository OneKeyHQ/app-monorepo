/* eslint-disable onekey/no-raw-error */
/* cspell:ignore sourcemap */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('../../../development/env');

const projectRoot = path.resolve(__dirname, '../../..');
const buildDir = path.resolve(__dirname, '../web-build');
const sentryCli = path.resolve(
  projectRoot,
  'node_modules/@sentry/cli/bin/sentry-cli',
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

function stripProductionArtifacts(directoryPath, label) {
  const removedFiles = cleanupProductionAssets(directoryPath);
  const remainingFiles = collectProductionArtifacts(directoryPath);
  if (remainingFiles.length > 0) {
    throw new Error(
      `${label} still contain sourcemaps or license files: ${remainingFiles.join(', ')}`,
    );
  }
  console.log(
    `Finalized ${label} and removed ${removedFiles.length} sourcemap/license files.`,
  );
  return removedFiles;
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
    cwd: projectRoot,
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_ORG: process.env.SENTRY_ORG || 'onekey-bb',
    },
    stdio: 'inherit',
  });
  if (result.error) {
    console.warn(
      `::warning::Desktop Sentry ${label} could not start: ${result.error.message}`,
    );
    return false;
  }
  if (result.status !== 0) {
    console.warn(
      `::warning::Desktop Sentry ${label} exited with status ${result.status}.`,
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
      'Skipping Desktop Sentry upload because its credentials are unavailable.',
    );
    return;
  }

  const release = resolveSentryRelease();
  const releaseArgs = release ? ['--release', release] : [];
  if (release) {
    runSentryCli(['releases', 'new', release], 'release creation');
  }

  // Desktop uses SRI, so upload without injecting debug IDs into emitted JS.
  const uploaded = runSentryCli(
    ['sourcemaps', 'upload', ...releaseArgs, '--url-prefix', '~/', buildDir],
    'sourcemap upload',
  );
  if (uploaded && release) {
    runSentryCli(['releases', 'finalize', release], 'release finalization');
  }
}

function finalizeProductionAssets({ stripOnly = false } = {}) {
  if (process.env.SENTRY_UPLOAD_BY_CLI === 'true' && !stripOnly) {
    throw new Error(
      'SENTRY_UPLOAD_BY_CLI=true requires the external owner to run Rspack directly and invoke this finalizer with --strip-only before packaging.',
    );
  }

  let uploadError;
  try {
    if (!stripOnly) {
      uploadSourcemaps();
    }
  } catch (error) {
    uploadError = error;
  }

  const removedFiles = stripProductionArtifacts(
    buildDir,
    'Desktop production assets',
  );
  if (uploadError !== undefined) {
    const message =
      uploadError instanceof Error ? uploadError.message : String(uploadError);
    throw new Error(`Desktop production finalization failed: ${message}`, {
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
  stripProductionArtifacts,
};
