#import "AppDelegate.h"
#import "JPushManager.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

#ifdef DEBUG
#else
#import <Firebase/Firebase.h>
#endif

// #ifdef FB_SONARKIT_ENABLED
// #import <FlipperKit/FlipperClient.h>
// #import <FlipperPerformancePlugin.h>
// #endif

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
// #ifdef FB_SONARKIT_ENABLED
//   FlipperClient *client = [FlipperClient sharedClient];
//   [client addPlugin:[FlipperPerformancePlugin new]];
// #endif

  [JPushManager shareInstance];
  
#ifdef DEBUG
#else
  NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  if (![version isEqualToString:@"1"]) {
    [FIRApp configure];
  }
#endif
  
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = launchOptions;

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}


- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
 #ifdef DEBUG
  NSURL *rootUrl = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
  return [NSURL URLWithString: [rootUrl.absoluteString stringByAppendingString:@"&inlineSourceMap=true"]];
 #else
    return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
 #endif
}

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  return [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

//注册 APNS 成功并上报 DeviceToken
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [JPUSHService registerDeviceToken:deviceToken];
}

@end

