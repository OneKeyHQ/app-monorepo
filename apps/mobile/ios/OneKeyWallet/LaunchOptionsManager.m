//
//  LaunchOptionsManager.m
//  OneKeyWallet
//
//  Created by OneKey on 2024.
//

#import "LaunchOptionsManager.h"
#import <React/RCTLog.h>

@interface LaunchOptionsManager ()
@property (nonatomic, strong) NSDictionary *launchOptions;
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

// MARK: - RCTBridgeModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getLaunchOptions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSDictionary *launchOptions = [self getLaunchOptions];
    if (launchOptions) {
        NSMutableDictionary *result = [NSMutableDictionary dictionary];
        
        // Get local notification if exists
        id localNotification = launchOptions[UIApplicationLaunchOptionsLocalNotificationKey];
        if (localNotification) {
            result[@"localNotification"] = localNotification;
        }
        
        // Get remote notification if exists 
        id remoteNotification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
        if (remoteNotification) {
            result[@"remoteNotification"] = remoteNotification;
        }
        // Get manual launch notification if exists
        id manualNotification = launchOptions[UIApplicationLaunchOptionsSourceApplicationKey];
        if (manualNotification) {
            result[@"sourceApplication"] = manualNotification;
        }
        resolve(result);
    } else {
        resolve(@{});
    }
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
