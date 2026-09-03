const thirdPartyRuntimePatchPackages = [
  {
    packageName: '@stoprocent/noble',
    files: [
      {
        relativePath: 'lib/common/include/Emit.h',
        requiredMarkers: [
          'const std::string& errorDomain = "", int errorCode = 0',
        ],
      },
      {
        relativePath: 'lib/common/src/Emit.cc',
        requiredMarkers: [
          'error.Set(_s("nativeErrorDomain"), _s(domain))',
          'error.Set(_s("nativeErrorCode"), _n(code))',
        ],
      },
      {
        relativePath: 'lib/mac/src/ble_manager.mm',
        requiredMarkers: [
          'emit.Disconnected(uuid, errorMessage, errorDomain, errorCode)',
          'emit.Connected(uuid, errorMessage, errorDomain, errorCode)',
        ],
      },
      {
        relativePath: 'lib/noble.js',
        requiredMarkers: [
          "const wasConnecting = peripheral.state === 'connecting'",
        ],
      },
    ],
  },
];

module.exports = {
  thirdPartyRuntimePatchPackages,
};
