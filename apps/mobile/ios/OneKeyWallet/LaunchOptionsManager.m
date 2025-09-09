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
    @synchronized(self) {
        self.launchOptions = launchOptions;
        RCTLogInfo(@"LaunchOptionsManager: Saved launch options: %@", launchOptions);
    }
}

- (NSDictionary *)getLaunchOptions {
    @synchronized(self) {
        return self.launchOptions;
    }
}

// MARK: - RCTBridgeModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getLaunchOptions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSDictionary *launchOptions = [self getLaunchOptions];
    if (launchOptions) {
        resolve(launchOptions);
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
