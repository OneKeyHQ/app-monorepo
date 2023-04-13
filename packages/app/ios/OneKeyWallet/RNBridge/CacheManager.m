#import "CacheManager.h"
#import "WebKit/WKWebsiteDataStore.h"

@implementation CacheManager


RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(clearWebViewData:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSSet *websiteDataTypes = [WKWebsiteDataStore allWebsiteDataTypes];
  NSDate *dateFrom = [NSDate dateWithTimeIntervalSince1970:0];
  dispatch_async(dispatch_get_main_queue(), ^{
    NSArray *cookies = [[NSHTTPCookieStorage sharedHTTPCookieStorage] cookies];
    for (NSHTTPCookie *cookie in cookies) {
      [[NSHTTPCookieStorage sharedHTTPCookieStorage] deleteCookie:cookie];
    }
    [[WKWebsiteDataStore defaultDataStore] removeDataOfTypes:websiteDataTypes modifiedSince:dateFrom completionHandler:^{
      return resolve(@(true));
    }];
  });
}

@end
