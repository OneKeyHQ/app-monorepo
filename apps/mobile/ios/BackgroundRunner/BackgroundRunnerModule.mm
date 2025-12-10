#import "BackgroundRunnerModule.h"
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <React_RCTAppDelegate/RCTReactNativeFactory.h>
#if __has_include(<ReactAppDependencyProvider/RCTAppDependencyProvider.h>)
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#elif __has_include("RCTAppDependencyProvider.h")
#import "RCTAppDependencyProvider.h"
#endif
#import "BackgroundRunnerReactNativeDelegate.h"

@interface BackgroundRunnerModule ()
@property (nonatomic, strong) BackgroundReactNativeDelegate *reactNativeFactoryDelegate;
@property (nonatomic, strong) RCTReactNativeFactory *reactNativeFactory;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL isStarted;
@end

@implementation BackgroundRunnerModule

static BackgroundRunnerModule *sharedInstance = nil;
static BOOL isStarted = NO;
static NSString *const MODULE_NAME = @"background";
static NSString *const MODULE_DEBUG_URL = @"http://localhost:8082/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable";

RCT_EXPORT_MODULE(BackgroundRunnerModule)

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

+ (instancetype)sharedInstance {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[self alloc] init];
    sharedInstance.reactNativeFactoryDelegate = [[BackgroundReactNativeDelegate alloc] init];
    sharedInstance.reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:sharedInstance.reactNativeFactoryDelegate];
  });
  return sharedInstance;
}

- (instancetype)init {
    if (self = [super init]) {
        if (!sharedInstance) {
            sharedInstance = self;
        }
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"toUI", @"toBackground"];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
}

RCT_EXPORT_METHOD(startBackgroundRunner) {
  if (isStarted) {
    return;
  }
  isStarted = YES;
  
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *initialProperties = @{};
    NSDictionary *launchOptions = @{};
    #if DEBUG
    [self.reactNativeFactoryDelegate setJsBundleSource:std::string([MODULE_DEBUG_URL UTF8String])];
    #endif
    [self.reactNativeFactory.rootViewFactory viewWithModuleName:MODULE_NAME
                                                             initialProperties:initialProperties
                                                                 launchOptions:launchOptions];
  });
}

RCT_EXPORT_METHOD(sendToUI:(NSDictionary *)msg) {
  NSLog(@"[BackgroundRunnerModule] Received message: %@", msg);
  if (_hasListeners) {
    [self sendEventWithName:@"toUI" body:msg];
  }
}

RCT_EXPORT_METHOD(sendToBackground:(NSDictionary *)msg) {
  NSLog(@"[BackgroundRunnerModule] Received message: %@", msg);
  if (_hasListeners) {
    [self sendEventWithName:@"toBackground" body:msg];
  }
}

@end
