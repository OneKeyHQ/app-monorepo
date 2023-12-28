const projectRoot = __dirname;
const linkAssets = require('react-native-copy-asset');

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
