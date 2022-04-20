#import "NFCConfig.h"
#import "ReactNativeConfig.h"

@implementation NFCConfig

+ (NSDictionary *)env {
  return ReactNativeConfig.env;
}

+ (NSString *)envFor: (NSString *)key {
    NSString *value = (NSString *)[self.env objectForKey:key];
    return value;
}

@end
