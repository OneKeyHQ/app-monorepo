module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: ['RNCNativeOverlayComponentDescriptor'],
        cmakeListsPath: undefined,
        packageImportPath:
          'import com.onekey.nativeoverlay.NativeOverlayPackage;',
        packageInstance: 'new NativeOverlayPackage()',
      },
    },
  },
};
