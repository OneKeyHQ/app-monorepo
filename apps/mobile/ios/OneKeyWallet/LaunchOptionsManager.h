#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

#import "JPUSHService.h"
#import "RCTJPushModule.h"

@interface LaunchOptionsManager : NSObject <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (void)log:(NSString *)msg;
- (void)saveLaunchOptions:(NSDictionary *)launchOptions;
- (NSDictionary *)getLaunchOptions;
- (void)saveDeviceToken:(NSData *)deviceToken;
- (NSData *)getDeviceToken;
- (void)saveStartupTime:(NSNumber *)startupTime;
- (NSNumber *)getStartupTime;
@end
