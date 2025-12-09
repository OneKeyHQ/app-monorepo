#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface BackgroundRunnerModule : RCTEventEmitter <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (void)startBackgroundRunner;
- (void)sendToUI:(NSDictionary *)msg;
- (void)sendToBackground:(NSDictionary *)msg;

@end

