//
//  OKNFCUtility.m
//  OKNFC
//
//  Created by zj on 2021/5/1.
//

#import "OKNFCUtility.h"

@implementation OKNFCUtility

+ (void)logAPDU:(NSString *)name response:(NSData *)responseData sw1:(uint8_t)sw1 sw2:(uint8_t)sw2 error:(NSError *)error {
    BOOL ok = sw1 == OKNFC_SW1_OK;
    NSString *sw1e = ok ? @"成功 ✅" : @"失败 ❌";
    NSString *msg = [NSString stringWithFormat:@"OKNFC: Log %@: %@ \n-> sw1: %d(%x) sw2: %d(%x) err:%@ \n-> responseData: %@", name, sw1e, sw1, sw1, sw2, sw2, error, responseData];
    NSLog(@"%@", msg);
    if (!ok) {
//        [kTools debugTipMessage:msg];
    }
}

@end
