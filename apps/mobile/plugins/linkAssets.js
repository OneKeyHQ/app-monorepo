const linkAssets = (projectRoot) => {
  const linkAssets = require('react-native-copy-asset');
  console.log(
    `info Linking chunk bundle to native app. ${new Date().toISOString()}`,
  );
  const assets = ['./dist/chunks'];
  linkAssets({
    rootPath: projectRoot,
    shouldUnlink: false,
    platforms: {
      ios: {
        enabled: true,
        assets,
      },
      android: {
        enabled: true,
        assets,
      },
    },
  });
  console.log(
    `info Linked chunk bundle to native app. ${new Date().toISOString()}`,
  );
};

exports.linkAssets = linkAssets;
if (process && process.argv &&process.argv[1] === __filename) {
  linkAssets(require('path').resolve(__dirname, '..'));
}
