const { RawSource } = require('webpack-sources');

class ChromeExtensionV3ViolationPlugin {
  constructor(replaceConfigs) {
    this.replaceConfigs = replaceConfigs;
  }

  apply(compiler) {
    compiler.hooks.emit.tap(
      'ChromeExtensionV3ViolationPlugin',
      (compilation) => {
        const files = Object.keys(compilation.assets);
        files.forEach((file) => {
          let hasFileChanged = false;
          const asset = compilation.assets[file];
          let content = asset.source().toString();
          this.replaceConfigs.forEach((config) => {
            if (config.regexToFind.test(content)) {
              hasFileChanged = true;
              content = content.replace(config.regexToFind, config.replacement);
            }
          });
          if (hasFileChanged) {
            compilation.assets[file] = new RawSource(content);
          }
        });
      },
    );
  }
}

module.exports = ChromeExtensionV3ViolationPlugin;