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

@implementation BackgroundRunnerModule
{
  BOOL _hasListeners;
  RCTReactNativeFactory *_reactNativeFactory;
  BackgroundReactNativeDelegate *_reactNativeFactoryDelegate;
}

static BackgroundRunnerModule *sharedInstance = nil;
static BOOL isStarted = NO;

RCT_EXPORT_MODULE(BackgroundRunnerModule)

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

+ (instancetype)sharedInstance {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[self alloc] init];
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
      self->_reactNativeFactoryDelegate = [[BackgroundReactNativeDelegate alloc] init];
      
      Class dependencyProviderClass = NSClassFromString(@"RCTAppDependencyProvider");
      if (dependencyProviderClass) {
          self->_reactNativeFactoryDelegate.dependencyProvider = [[dependencyProviderClass alloc] init];
      } else {
          NSLog(@"[BackgroundRunnerModule] Warning: RCTAppDependencyProvider class not found.");
      }
      
      self->_reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self->_reactNativeFactoryDelegate];
      [self->_reactNativeFactory.rootViewFactory viewWithModuleName:@"background" initialProperties:@{}];
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
