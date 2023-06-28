//
//  Bridge.h
//  NFCTagReader
//
//  Created by zj on 2021/3/16.
//  Copyright © 2021 Apple. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreNFC/CoreNFC.h>


NS_ASSUME_NONNULL_BEGIN

@interface OKNFCBridge : NSObject
+ (NFCISO7816APDU *)buildAPDUWith_cla:(unsigned long)cla ins:(unsigned long)ins p1:(unsigned long)p1 p2:(unsigned long)p2 data:(NSString *)data encrypt:(BOOL)encrypt;
+ (NSString *)mutualAuthData;
+ (BOOL)openChannel:(NSData *)authRes;
+ (BOOL)JUB_GPC_Initialize:(NSData *)cert;
+ (NSString *)parseSafeAPDUResponse:(NSData *)data sw1:(uint8_t)sw1 sw2:(uint8_t)sw2;
+ (BOOL)parseAPDUResponse:(NSData *)data;
+ (BOOL)verifySN:(NSString *)SNData withCert:(NSData *)cert;
+ (NFCISO7816APDU *)buildAPDUWithStr:(NSString *)str encrypt:(BOOL)encrypt;
+ (void)closeSecureChannel;

@end

NS_ASSUME_NONNULL_END
