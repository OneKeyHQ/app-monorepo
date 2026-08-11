/* eslint-disable onekey/no-raw-error */
const path = require('path');

const fs = require('fs-extra');

const { stripProductionArtifacts } = require('./finalize-production-assets');

const root = path.join(__dirname, '..');
const webBuildDir = path.join(root, 'web-build');
const appBuildDir = path.join(root, 'app', 'build');
const publicStaticDir = path.join(root, 'public', 'static');
const appBuildStaticDir = path.join(appBuildDir, 'static');
const forbiddenDevelopmentMarkers = [
  'CustomInjected',
  'CustomInjection',
  'customInjection',
  'custom-injected',
  'custom_injected',
  'CUSTOM_INJECTION',
  'desktopPreloadUrl',
  'onekey_custom_injection_enabled',
  'onekey-app-custom-injected',
];

function collectJavaScriptFiles(directoryPath) {
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectJavaScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
    });
}

function verifyProductionRendererExcludesDevelopmentModules(directoryPath) {
  const leaks = collectJavaScriptFiles(directoryPath).flatMap((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const markers = forbiddenDevelopmentMarkers.filter((marker) =>
      source.includes(marker),
    );
    return markers.length > 0
      ? [`${path.relative(directoryPath, filePath)}: ${markers.join(', ')}`]
      : [];
  });
  if (leaks.length > 0) {
    throw new Error(
      `Production Desktop renderer contains development-only modules:\n${leaks.join(
        '\n',
      )}`,
    );
  }
  console.log(
    'Verified production Desktop renderer excludes development-only modules.',
  );
}

async function postBuild() {
  try {
    // The old script did `mv ./web-build ./app/build`.
    // Move the Rspack renderer output from web-build to app/build.
    if (await fs.pathExists(webBuildDir)) {
      console.log(`Moving ${webBuildDir} to ${appBuildDir}...`);
      // Remove existing app/build if it exists
      await fs.remove(appBuildDir);
      // Move web-build to app/build
      await fs.move(webBuildDir, appBuildDir);
    } else {
      console.error(
        `Error: Source directory ${webBuildDir} does not exist. Rspack build might have failed.`,
      );
      process.exit(1);
    }

    // The old script did `rsync -a public/static/ app/build/static`.
    if (await fs.pathExists(publicStaticDir)) {
      console.log(`Copying ${publicStaticDir} to ${appBuildStaticDir}...`);
      await fs.copy(publicStaticDir, appBuildStaticDir);
    } else {
      console.log(`Info: No ${publicStaticDir} found to copy.`);
    }

    stripProductionArtifacts(appBuildDir, 'Desktop packaged renderer assets');
    verifyProductionRendererExcludesDevelopmentModules(appBuildDir);

    console.log('Post-renderer build steps completed successfully.');
  } catch (err) {
    console.error('Error during post-renderer build steps:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  postBuild();
}

module.exports = {
  collectJavaScriptFiles,
  verifyProductionRendererExcludesDevelopmentModules,
};
