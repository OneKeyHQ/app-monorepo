#import "RCTBundleModule.h"
#import "Category/RCTBridge.h"

@implementation RCTBundleModule

static RCTBridge *rctBridge = nil;

RCT_EXPORT_MODULE(Bundle);

+ (void)setBridge:(RCTBridge *)bridge {
  rctBridge = bridge;
}


RCT_EXPORT_METHOD(executeSourceCode:(NSString *)hashId resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  
  NSString * resourcePath = [[NSBundle mainBundle] resourcePath];
  NSString * path = [resourcePath stringByAppendingString:hashId];
  NSError* error = nil;
  NSData* data = [NSData dataWithContentsOfFile:path  options:0 error:&error];
  [rctBridge executeSourceCode:data sync: YES];
  resolve(nil);
}

@end
