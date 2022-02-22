#import "NFCConfig.h"
#import "NFCENV.m"

#ifdef DEBUG
#import "ReactNativeConfig.h"
#else
#import "NFCENV.m"
#endif


@implementation NFCConfig

+ (NSDictionary *)env {
#ifdef DEBUG
  return ReactNativeConfig.env;
#else
  return (NSDictionary *)DOT_ENV;
#endif
}

+ (NSString *)envFor: (NSString *)key {
    NSString *value = (NSString *)[self.env objectForKey:key];
    return value;
}

@end
