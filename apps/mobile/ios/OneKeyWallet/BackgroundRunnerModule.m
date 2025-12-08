#import "BackgroundRunnerModule.h"

@implementation BackgroundRunnerModule
{
    BOOL _hasListeners;
}

static RCTRootView *backgroundRootView = nil;

RCT_EXPORT_MODULE();

+ (instancetype)sharedInstance
{
    static BackgroundRunnerModule *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"toUI", @"toBackground"];
}

- (void)startBackgroundRunner
{
    if (backgroundRootView != nil) {
        return;
    }
    
    NSString *urlString = @"http://localhost:8081/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable";
    NSURL *jsCodeLocation = [NSURL URLWithString:urlString];
    backgroundRootView = [[RCTRootView alloc] initWithBundleURL:jsCodeLocation
                                                      moduleName:@"background"
                                               initialProperties:nil
                                                   launchOptions:nil];
}

RCT_EXPORT_METHOD(sendMessage:(NSDictionary *)msg)
{
    NSLog(@"[BackgroundRunnerModule] Received message: %@", msg);
    [self sendEventWithName:@"toUI" body:msg];
}

@end
