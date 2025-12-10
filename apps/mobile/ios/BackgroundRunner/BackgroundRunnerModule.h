#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface BackgroundRunnerModule : RCTEventEmitter <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (void)startBackgroundRunner;

@end

