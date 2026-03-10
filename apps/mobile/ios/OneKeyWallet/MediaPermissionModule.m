#import <React/RCTBridgeModule.h>
#import <react-native-webview/RNCWebViewImpl.h>

@interface MediaPermissionModule : NSObject <RCTBridgeModule>
@end

@implementation MediaPermissionModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setMediaPermissionWhitelist:(NSArray<NSString *> *)origins) {
  [RNCWebViewImpl setMediaPermissionWhitelist:origins];
}

@end
