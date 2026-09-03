const thirdPartyRuntimePatchPackages = [
  {
    packageName: '@stoprocent/noble',
    files: [
      {
        relativePath: 'lib/common/include/Emit.h',
        requiredMarkers: [
          'Disconnected(const std::string& uuid, const std::string& error',
        ],
      },
      {
        relativePath: 'lib/common/src/Emit.cc',
        requiredMarkers: ['error.empty() ? env.Null() : _e(error)'],
      },
      {
        relativePath: 'lib/mac/src/ble_manager.mm',
        requiredMarkers: [
          'error.domain, (long)error.code',
          'emit.Disconnected(uuid, errorMessage)',
        ],
      },
      {
        relativePath: 'lib/noble.js',
        requiredMarkers: [
          "peripheral.state === 'connecting' && reason instanceof Error",
        ],
      },
    ],
  },
];

module.exports = {
  thirdPartyRuntimePatchPackages,
};
