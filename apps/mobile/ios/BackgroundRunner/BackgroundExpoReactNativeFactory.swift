import Expo

@objc(BackgroundExpoReactNativeFactory)
public class BackgroundExpoReactNativeFactory: NSObject {
    public static func create(delegate: ExpoReactNativeFactoryDelegate) -> ExpoReactNativeFactory {
        return ExpoReactNativeFactory(delegate: delegate)
    }
}
