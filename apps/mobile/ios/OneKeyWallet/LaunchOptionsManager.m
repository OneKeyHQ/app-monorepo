#import "LaunchOptionsManager.h"
#import <React/RCTLog.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

static const DDLogLevel ddLogLevel = DDLogLevelVerbose;

@interface LaunchOptionsManager ()
@property (nonatomic, strong) NSDictionary *launchOptions;
@property (nonatomic, strong) NSString *deviceToken;

@end

@implementation LaunchOptionsManager

static LaunchOptionsManager *sharedInstance = nil;

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        self.launchOptions = nil;
    }
    return self;
}

- (void)saveLaunchOptions:(NSDictionary *)launchOptions {
    if (launchOptions) {
        // Show alert with launch options on main thread
        self.launchOptions = launchOptions;
        RCTLogInfo(@"LaunchOptionsManager: Saved launch options: %@", launchOptions);
    } else {
        RCTLogInfo(@"LaunchOptionsManager: Launch options is nil, skipping save");
    }
}

- (NSDictionary *)getLaunchOptions {
    @synchronized(self) {
        // Show alert with current launch options on main thread
        return [LaunchOptionsManager sharedInstance].launchOptions;
    }
}

- (void)saveDeviceToken:(NSString *)deviceToken {
    if (deviceToken) {
        self.deviceToken = deviceToken;
    }
}

- (NSString *)getDeviceToken {
    return [LaunchOptionsManager sharedInstance].deviceToken;
}

// MARK: - RCTBridgeModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getLaunchOptions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSDictionary *launchOptions = [self getLaunchOptions];

    DDLogDebug(@"getLaunchOptions: has launch options %@", launchOptions ? @"YES" : @"NO");
    if (launchOptions) {
        NSMutableDictionary *result = [NSMutableDictionary dictionary];
        
        // Get local notification if exists
        id localNotification = launchOptions[UIApplicationLaunchOptionsLocalNotificationKey];
        if (localNotification) {
            if ([localNotification isKindOfClass:[UILocalNotification class]]) {
                UILocalNotification *notification = (UILocalNotification *)localNotification;
                NSMutableDictionary *notificationInfo = [NSMutableDictionary dictionary];
                notificationInfo[@"fireDate"] = notification.fireDate ? @([notification.fireDate timeIntervalSince1970]) : [NSNull null];
                notificationInfo[@"userInfo"] = notification.userInfo ?: [NSNull null];
                result[@"localNotification"] = notificationInfo;
            }
        }
        
        // Get remote notification if exists 
        id remoteNotification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
        if (remoteNotification) {
            if ([remoteNotification isKindOfClass:[NSDictionary class]]) {
                NSMutableDictionary *notificationInfo = [NSMutableDictionary dictionary];
                notificationInfo[@"fireDate"] = remoteNotification[@"fireDate"] ? @([remoteNotification[@"fireDate"] timeIntervalSince1970]) : [NSNull null];
                notificationInfo[@"userInfo"] = remoteNotification[@"userInfo"] ?: [NSNull null];
                result[@"remoteNotification"] = notificationInfo;
            }
        }
        // Get manual launch notification if exists
        // Check if app was launched from local notification
        if (launchOptions[UIApplicationLaunchOptionsLocalNotificationKey]) {
            result[@"launchType"] = @"localNotification";
        }
        // Check if app was launched from remote notification 
        else if (launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey]) {
            result[@"launchType"] = @"remoteNotification";
        }
        // Otherwise normal launch
        else {
            result[@"launchType"] = @"normal";
        }
        DDLogDebug(@"getLaunchOptions: %@", result);
        resolve(result);
    } else {
        resolve(@{});
    }
}

RCT_EXPORT_METHOD(getDeviceToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *deviceToken = [self getDeviceToken];
    resolve(deviceToken);
}

RCT_EXPORT_METHOD(clearLaunchOptions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @synchronized(self) {
        self.launchOptions = nil;
        RCTLogInfo(@"LaunchOptionsManager: Cleared launch options");
    }
    resolve(@YES);
}

@end
