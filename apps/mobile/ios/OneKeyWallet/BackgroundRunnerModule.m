#import "BackgroundRunnerModule.h"
#import "BackgroundReactNativeDelegate.h"

#import <Expo/Expo-Swift.h>
#import <ExpoModulesCore/ExpoModulesCore-Swift.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <React/RCTEventEmitter.h>

@implementation BackgroundRunnerModule {
    BOOL _hasListeners;
}

static RCTRootView *backgroundRootView = nil;

RCT_EXPORT_MODULE();

+ (instancetype)sharedInstance {
    static BackgroundRunnerModule *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"toUI", @"toBackground"];
}

- (void)startBackgroundRunner {
    // Prevent multiple inits
    if (backgroundRootView != nil) {
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        // Create BackgroundReactNativeDelegate
        BackgroundReactNativeDelegate *delegate = [[BackgroundReactNativeDelegate alloc] init];
        ExpoReactNativeFactory *factory = [[ExpoReactNativeFactory alloc] initWithDelegate:delegate];
        [delegate setDependencyProvider: [[RCTAppDependencyProvider alloc] init]];
        bindReactNativeFactory(factory);

        UIWindow *window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
        // This assumes JS entry point is "background"
        [factory startReactNativeWithModuleName:BACKGROUND_BUNDLE_NAME inWindow:window launchOptions:nil];
    });
}

RCT_EXPORT_METHOD(sendToUI:(NSDictionary *)msg) {
    NSLog(@"[BackgroundRunnerModule] Received message: %@", msg);
    [self sendEventWithName:@"toUI" body:msg];
}

RCT_EXPORT_METHOD(sendToBackground:(NSDictionary *)msg) {
    NSLog(@"[BackgroundRunnerModule] Received message: %@", msg);
    [self sendEventWithName:@"toBackground" body:msg];
}

@end
