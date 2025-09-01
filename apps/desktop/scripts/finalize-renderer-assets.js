const fs = require('fs-extra');
const path = require('path');

const root = path.join(__dirname, '..');
const webBuildDir = path.join(root, 'web-build');
const appBuildDir = path.join(root, 'app', 'build');
const publicStaticDir = path.join(root, 'public', 'static');
const appBuildStaticDir = path.join(appBuildDir, 'static');

async function postBuild() {
  try {
    // The old script did `mv ./web-build ./app/build`.
    // We need to move the webpack output from web-build to app/build
    if (await fs.pathExists(webBuildDir)) {
      console.log(`Moving ${webBuildDir} to ${appBuildDir}...`);
      // Remove existing app/build if it exists
      await fs.remove(appBuildDir);
      // Move web-build to app/build
      await fs.move(webBuildDir, appBuildDir);
    } else {
      console.error(`Error: Source directory ${webBuildDir} does not exist. Webpack build might have failed.`);
      process.exit(1);
    }

    // The old script did `rsync -a public/static/ app/build/static`.
    if (await fs.pathExists(publicStaticDir)) {
      console.log(`Copying ${publicStaticDir} to ${appBuildStaticDir}...`);
      await fs.copy(publicStaticDir, appBuildStaticDir);
    } else {
      console.log(`Info: No ${publicStaticDir} found to copy.`);
    }

    console.log('Post-renderer build steps completed successfully.');
  } catch (err) {
    console.error('Error during post-renderer build steps:', err);
    process.exit(1);
  }
}

postBuild();

