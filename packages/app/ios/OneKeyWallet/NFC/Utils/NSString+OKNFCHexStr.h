//
//  NSString+OKNFCHexStr.h
//
//  Created by linleiqin on 2023/6/20.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSString (OKNFCHexStr)

- (NSData *)dataFromHexString;
- (NSString *)hexString;

@end

NS_ASSUME_NONNULL_END
