//
//  OKNFCUtility.h
//  OKNFC
//
//  Created by zj on 2021/5/1.
//

#import <Foundation/Foundation.h>

static const uint8_t OKNFC_SW1_OK = 144;

NS_ASSUME_NONNULL_BEGIN

@interface OKNFCUtility : NSObject
+ (void)logAPDU:(NSString *)name response:(NSData *)responseData sw1:(uint8_t)sw1 sw2:(uint8_t)sw2 error:(NSError *)error;
@end

NS_ASSUME_NONNULL_END
