module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: ['OKNativeHomeTabsComponentDescriptor'],
        cmakeListsPath: undefined,
        packageImportPath:
          'import so.onekey.components.nativehometabs.OKNativeHomeTabsPackage;',
        packageInstance: 'new OKNativeHomeTabsPackage()',
      },
    },
  },
};
