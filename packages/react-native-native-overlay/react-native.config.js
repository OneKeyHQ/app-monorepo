module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: [
          'RNCNativeOverlayComponentDescriptor',
          'RNCNativeOverlayPageHostComponentDescriptor',
        ],
        cmakeListsPath: '../android/src/main/jni/CMakeLists.txt',
        packageImportPath:
          'import com.onekey.nativeoverlay.NativeOverlayPackage;',
        packageInstance: 'new NativeOverlayPackage()',
      },
    },
  },
};
