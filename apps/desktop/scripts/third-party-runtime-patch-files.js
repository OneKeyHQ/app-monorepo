const thirdPartyRuntimePatchPackages = [
  {
    packageName: '@stoprocent/noble',
    relativePaths: ['lib/mac/src/ble_manager.mm'],
    requiredMarkers: ['error.domain, (long)error.code'],
  },
];

module.exports = {
  thirdPartyRuntimePatchPackages,
};
