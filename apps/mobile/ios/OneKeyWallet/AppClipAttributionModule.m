#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppClipAttribution, NSObject)

RCT_EXTERN_METHOD(readPending:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPending:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
