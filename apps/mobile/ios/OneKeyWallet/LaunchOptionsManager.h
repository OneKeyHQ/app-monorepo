#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

@interface LaunchOptionsManager : NSObject <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (void)saveLaunchOptions:(NSDictionary *)launchOptions;
- (NSDictionary *)getLaunchOptions;

@end
