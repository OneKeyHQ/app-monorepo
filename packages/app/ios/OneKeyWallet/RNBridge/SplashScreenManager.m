//
//  SplashScreenManager.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/5/5.
//

#import "SplashScreenManager.h"
#import <EXSplashScreen/EXSplashScreenService.h>
#import <ExpoModulesCore/EXModuleRegistryProvider.h>
#import <EXSplashScreen/EXSplashScreenViewController.h>
#import <objc/runtime.h>

@implementation SplashScreenManager

RCT_EXPORT_MODULE();
RCT_EXPORT_METHOD(show)
{
  EXSplashScreenService *splashScreenService = (EXSplashScreenService *)[EXModuleRegistryProvider getSingletonModuleForClass:[EXSplashScreenService class]];
  EX_WEAKIFY(self);
  dispatch_async(dispatch_get_main_queue(), ^{
    EX_ENSURE_STRONGIFY(self);
    UIViewController *rootViewController = [(UIWindow *)UIApplication.sharedApplication.windows.firstObject rootViewController];
    NSMapTable *splashScreenControllers = nil;
    EXSplashScreenViewController *splashScreenController = nil;
    SEL selector = NSSelectorFromString(@"splashScreenControllers");
    if ([splashScreenService respondsToSelector:selector]) {
      
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      splashScreenControllers = [splashScreenService performSelector:selector];
#pragma clang diagnostic pop
      
      if (rootViewController && [splashScreenControllers objectForKey:rootViewController]) {
        splashScreenController = [splashScreenControllers objectForKey:rootViewController];
      }
    }
    [splashScreenController showWithCallback:^{} failureCallback:^(NSString * _Nonnull message) {}];
  });
}

@end
