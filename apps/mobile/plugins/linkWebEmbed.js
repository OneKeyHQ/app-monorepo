const linkWebEmbed = (projectRoot) => {
  const linkAssets = require('react-native-copy-asset');
  console.log(
    `info Linking chunk bundle to native app. ${new Date().toISOString()}`,
  );
  const assets = [
    require('path').resolve(projectRoot, '../web-embed/web-build'),
  ];
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

exports.linkWebEmbed = linkWebEmbed;
if (process && process.argv && process.argv[1] === __filename) {
  linkWebEmbed(require('path').resolve(__dirname, '..'));
}
