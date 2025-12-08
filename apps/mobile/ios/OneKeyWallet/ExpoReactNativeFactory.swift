import Foundation
import Expo

// Extend ExpoReactNativeFactory to add a new method for starting React Native in the background runner
extension ExpoReactNativeFactory {
  // This method starts the React Native instance with the given module name for background runner usage
  @objc
  func startBackgroundReactNative(
    withModuleName moduleName: String,
  ) {
    // Call the rootViewFactory to create the root view for the background runner
    self.rootViewFactory.view(
      withModuleName: moduleName,
      initialProperties: nil,
      launchOptions: nil
    )
  }
}
