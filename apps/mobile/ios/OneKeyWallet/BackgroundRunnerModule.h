#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTRootView.h>

@interface BackgroundRunnerModule : RCTEventEmitter <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (void)startBackgroundRunner;

@end
