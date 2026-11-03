const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '../..');
const iconAssetProvider = path.join(
  appRoot,
  'development/generated/onekey-icons/web/assetUrls.ts',
);
const iconAssetsAlias = { '#onekey-icon-assets$': iconAssetProvider };

function collectInputs(directory, files = [], directories = []) {
  directories.push(directory);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collectInputs(file, files, directories);
    else files.push(file);
  }
  return { files, directories };
}

class OneKeyIconAssetsPlugin {
  apply(compiler) {
    let previousDigest;
    let inputs;
    compiler.hooks.beforeCompile.tap('OneKeyIconAssetsPlugin', () => {
      if (
        compiler.options.resolve.alias['#onekey-icon-assets$'] !==
        iconAssetProvider
      ) {
        throw new Error('OneKey icons must resolve to this App resource table');
      }
      inputs = collectInputs(path.join(appRoot, 'packages/components/svg'));
      collectInputs(__dirname, inputs.files, inputs.directories);
      const hash = crypto.createHash('sha256');
      for (const file of inputs.files.toSorted())
        hash.update(file).update(fs.readFileSync(file));
      const sourceDigest = hash.digest('hex');
      if (previousDigest === sourceDigest && fs.existsSync(iconAssetProvider))
        return;
      execFileSync(
        process.execPath,
        [path.join(__dirname, 'generate-icons.mjs')],
        { cwd: appRoot },
      );
      previousDigest = sourceDigest;
    });
    compiler.hooks.afterCompile.tap('OneKeyIconAssetsPlugin', (compilation) => {
      for (const file of inputs.files) compilation.fileDependencies.add(file);
      for (const directory of inputs.directories)
        compilation.contextDependencies.add(directory);
    });
    compiler.hooks.normalModuleFactory.tap(
      'OneKeyIconAssetsPlugin',
      (factory) => {
        factory.hooks.afterResolve.tap('OneKeyIconAssetsPlugin', (result) => {
          if (
            result &&
            result.createData?.rawRequest === '#onekey-icon-assets' &&
            result.createData.resource !== iconAssetProvider
          ) {
            throw new Error(
              'OneKey icon provider resolved to an empty or foreign resource table',
            );
          }
        });
      },
    );
  }
}

module.exports = { iconAssetProvider, iconAssetsAlias, OneKeyIconAssetsPlugin };
