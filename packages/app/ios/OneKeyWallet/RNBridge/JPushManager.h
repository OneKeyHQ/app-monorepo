//
//  JPushManager.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/8/18.
//

#import <Foundation/Foundation.h>
#import <RCTJPushModule.h>

NS_ASSUME_NONNULL_BEGIN

@interface JPushManager : NSObject<JPUSHRegisterDelegate,RCTBridgeModule>

+ (instancetype)shareInstance;

@end

NS_ASSUME_NONNULL_END
