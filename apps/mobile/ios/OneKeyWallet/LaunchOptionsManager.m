//
//  LaunchOptionsManager.m
//  OneKeyWallet
//
//  Created by OneKey on 2024.
//

#import "LaunchOptionsManager.h"
#import <React/RCTLog.h>

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
        _launchOptions = nil;
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

RCT_EXPORT_METHOD(getLaunchOptions:(RCTResponseSenderBlock)callback) {
    NSDictionary *launchOptions = [self getLaunchOptions];
    if (launchOptions) {
        callback(@[[NSNull null], launchOptions]);
    } else {
        callback(@[[NSNull null], [NSNull null]]);
    }
}

RCT_EXPORT_METHOD(clearLaunchOptions:(RCTResponseSenderBlock)callback) {
    @synchronized(self) {
        self.launchOptions = nil;
        RCTLogInfo(@"LaunchOptionsManager: Cleared launch options");
    }
    callback(@[[NSNull null], @YES]);
}

// MARK: - Private Properties

@property (nonatomic, strong) NSDictionary *launchOptions;

@end
