const thirdPartyRuntimePatchPackages = [
  {
    packageName: '@sentry/electron',
    relativePaths: [
      'esm/main/integrations/preload-injection.js',
      'main/integrations/preload-injection.js',
    ],
    requiredMarkers: ['registerPreloadScript'],
  },
];

module.exports = {
  thirdPartyRuntimePatchPackages,
};
