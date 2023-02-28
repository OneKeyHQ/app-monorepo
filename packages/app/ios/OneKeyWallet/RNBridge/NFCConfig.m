#import "NFCConfig.h"
#import "RNCConfig.h"

@implementation NFCConfig

+ (NSDictionary *)env {
  return [RNCConfig env];
}

+ (NSString *)envFor: (NSString *)key {
    NSString *value = (NSString *)[self.env objectForKey:key];
    return value;
}

@end
