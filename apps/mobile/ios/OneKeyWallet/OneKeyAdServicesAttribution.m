#import <AdServices/AdServices.h>
#import <React/RCTBridgeModule.h>

@interface OneKeyAdServicesAttribution : NSObject <RCTBridgeModule>
@end

@implementation OneKeyAdServicesAttribution

RCT_EXPORT_MODULE(OneKeyAdServicesAttribution)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(getAttributionToken,
                 getAttributionTokenWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (@available(iOS 14.3, *)) {
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      NSError *error = nil;
      NSString *token = [AAAttribution attributionTokenWithError:&error];
      if (token.length > 0) {
        resolve(token);
        return;
      }
      reject(@"E_ADSERVICES_TOKEN", @"Unable to generate an Apple Ads attribution token", error);
    });
    return;
  }

  reject(@"E_ADSERVICES_UNAVAILABLE", @"Apple Ads attribution is unavailable on this iOS version", nil);
}

@end
