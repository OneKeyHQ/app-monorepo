#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(BackgroundRunnerModule, RCTEventEmitter)

RCT_EXTERN_METHOD(sendToUI:(NSDictionary *)msg)
RCT_EXTERN_METHOD(sendToBackground:(NSDictionary *)msg)

@end
