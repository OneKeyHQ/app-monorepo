const linkAssets = (projectRoot) => {
  const linkAssets = require('react-native-copy-asset');
  console.log(
    `info Linking chunk bundle to native app. ${new Date().toISOString()}`,
  );
  linkAssets({
    rootPath: projectRoot,
    shouldUnlink: false,
    platforms: {
      ios: {
        enabled: true,
        assets: ['./dist'],
      },
      android: {
        enabled: true,
        assets: ['./dist/chunks'],
      },
    },
  });
  console.log(
    `info Linked chunk bundle to native app. ${new Date().toISOString()}`,
  );
};

exports.linkAssets = linkAssets;

// linkAssets(require('path').resolve(__dirname, '..'));
