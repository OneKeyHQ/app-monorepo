#import "RCTBundleModule.h"
#import <React/RCTBridge+Private.h>
#import "Category/RCTBridge.h"

@implementation RCTBundleModule


RCT_EXPORT_MODULE(Bundle);



RCT_EXPORT_METHOD(executeSourceCode:(NSString *)hashId resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  
  NSString * resourcePath = [[NSBundle mainBundle] resourcePath];
  NSString *path = [NSString stringWithFormat:@"%@/%@.bundle", resourcePath, hashId];
  NSError* error = nil;
  NSData* data = [NSData dataWithContentsOfFile:path  options:NSDataReadingMappedIfSafe error:&error];
  RCTBridge *bridge = RCTBridge.currentBridge;
  [bridge executeSourceCode:data withSourceURL:[NSURL URLWithString:path] sync:NO];
  resolve(nil);
}

@end
