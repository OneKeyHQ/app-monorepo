#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OneKeyMarketWidget, NSObject)
RCT_EXTERN_METHOD(setConfiguration:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
