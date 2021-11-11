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
@interface NSData (OKNFCHexData)
- (NSString *)toHexString;
@end

@interface OKNFCBridge : NSObject
+ (NFCISO7816APDU *)buildAPDUWith_cla:(unsigned long)cla ins:(unsigned long)ins p1:(unsigned long)p1 p2:(unsigned long)p2 data:(NSString *)data encrypt:(BOOL)encrypt;
+ (NSString *)mutualAuthData;
+ (BOOL)openChannel:(NSData *)authRes;
+ (BOOL)JUB_GPC_Initialize:(NSData *)cert;
+ (BOOL)verifySN:(NSString *)SNData withCert:(NSData *)cert;

+ (NFCISO7816APDU *)buildAPDUWithStr:(NSString *)str;
+ (NFCISO7816APDU *)selectSecure;
+ (NFCISO7816APDU *)selectBackup;
+ (NFCISO7816APDU *)getCardSN;
+ (NFCISO7816APDU *)getCardCert;
+ (NFCISO7816APDU *)getBackupStatus;
+ (NFCISO7816APDU *)getPINStatus;
+ (NFCISO7816APDU *)setPIN:(NSString *)pin;
+ (NFCISO7816APDU *)verifyPIN:(NSString *)pin;
+ (NFCISO7816APDU *)importMnemonic:(NSString *)mnemonic;
+ (NFCISO7816APDU *)exportMnemonic;
+ (NFCISO7816APDU *)wipeCard;
+ (NFCISO7816APDU *)pinRTL;

+ (NFCISO7816APDU *)openChannel_1;
+ (NFCISO7816APDU *)openChannel_2;
+ (NFCISO7816APDU *)changePIN:(NSString *)oldPin newPin:(NSString *)newPin;

@end

NS_ASSUME_NONNULL_END
