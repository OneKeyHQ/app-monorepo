//
//  NFCConfig.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/2/22.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NFCConfig : NSObject

+ (NSDictionary *)env;
+ (NSString *)envFor: (NSString *)key;

@end

NS_ASSUME_NONNULL_END
