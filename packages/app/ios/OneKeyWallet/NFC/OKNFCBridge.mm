//
//  Bridge.m
//  NFCTagReader
//
//  Created by zj on 2021/3/16.
//  Copyright © 2021 Apple. All rights reserved.
//

#import "OKNFCBridge.h"
#import "GPChannelSDKCore.h"
#import "NFCConfig.h"

static NSString *LITE_CERT = [NFCConfig envFor:@"LITE_CERT"];

@implementation NSString(OKNFCHexStr)
- (NSData *)dataFromHexString {
    NSString *string = [self lowercaseString];
    NSMutableData *data= [NSMutableData new];
    unsigned char whole_byte;
    char byte_chars[3] = {'\0','\0','\0'};
    int i = 0;
    NSUInteger length = string.length;
    while (i < length-1) {
        char c = [string characterAtIndex:i++];
        if (c < '0' || (c > '9' && c < 'a') || c > 'f')
            continue;
        byte_chars[0] = c;
        byte_chars[1] = [string characterAtIndex:i++];
        whole_byte = strtol(byte_chars, NULL, 16);
        [data appendBytes:&whole_byte length:1];
    }
    return data;
}

- (NSString *)hexString {
    NSData* nsData = [self dataUsingEncoding:NSUTF8StringEncoding];
    const char* data = (const char*)[nsData bytes];
    NSUInteger len = nsData.length;
    NSMutableString* hex = [NSMutableString string];
    for(int i = 0; i < len; ++i)[hex appendFormat:@"%02X", data[i]];
    return hex;
}
@end

@implementation NSData (OKNFCHexData)
- (NSString *)toHexString {
    const unsigned char *dataBuffer = (const unsigned char *)[self bytes];

    if (!dataBuffer)
        return [NSString string];

    NSUInteger          dataLength  = [self length];
    NSMutableString     *hexString  = [NSMutableString stringWithCapacity:(dataLength * 2)];

    for (int i = 0; i < dataLength; ++i)
        [hexString appendString:[NSString stringWithFormat:@"%02lx", (unsigned long)dataBuffer[i]]];

    return [NSString stringWithString:hexString];
}

@end

@implementation OKNFCBridge

+ (NFCISO7816APDU *)buildAPDUWith_cla:(unsigned long)cla
                                  ins:(unsigned long)ins
                                   p1:(unsigned long)p1
                                   p2:(unsigned long)p2
                                 data:(NSString *)data
                              encrypt:(BOOL)encrypt {
    JUB_RV rv = JUBR_ERROR;
    JUB_CHAR_CPTR c_data = [data UTF8String];
    JUB_CHAR_PTR apdu = NULL;

    if (encrypt) {
        rv = JUB_GPC_BuildSafeAPDU(cla, ins, p1, p2, c_data, &apdu);
    } else {
        rv = JUB_GPC_BuildAPDU(cla, ins, p1, p2, c_data, &apdu);
    }

    if (JUBR_OK != rv) {
        return nil;
    }

    NSString *hexStr = [NSString stringWithCString:apdu encoding:NSUTF8StringEncoding];
    NSData *APDUData = [hexStr dataFromHexString];
    NFCISO7816APDU *adpu = [[NFCISO7816APDU alloc] initWithData:APDUData];
    return adpu;
}

+ (NFCISO7816APDU *)buildAPDUWithStr:(NSString *)str {
    if (![str hasPrefix:@"0x"]) {
        NSAssert(0, @"must starts with 0x");
        return nil;
    }

    // drop str[10:12], since coreNFC will cal it for us.
    NSString *meta = [str substringWithRange:NSMakeRange(0, 10)];
    NSString *data = @"";
    if (str.length > 12) {
        data = [str substringFromIndex:12];
    }

    unsigned long long outVal;
    NSScanner* scanner = [NSScanner scannerWithString:meta];
    [scanner scanHexLongLong:&outVal];

    unsigned long cla = outVal >> 24 & 0xff;
    unsigned long ins = outVal >> 16 & 0xff;
    unsigned long p1 =  outVal >> 8  & 0xff;
    unsigned long p2 =  outVal & 0xff;

    return [OKNFCBridge buildAPDUWith_cla:cla ins:ins p1:p1 p2:p2 data:data encrypt:NO];
}


+ (NSString *)mutualAuthData {
    JUB_CHAR_PTR mutualAuthData;
    JUB_RV rv = JUB_GPC_BuildMutualAuthData(&mutualAuthData);

    if (JUBR_OK != rv) {
        return nil;
    }

    return [NSString stringWithFormat:@"%s", mutualAuthData];
}

+ (BOOL)openChannel:(NSData *)authRes {
    JUB_CHAR_CPTR authResp = [[authRes toHexString] UTF8String];
    JUB_RV rv;

    rv = JUB_GPC_OpenSecureChannel(authResp);
    if (JUBR_OK != rv) {
        NSLog(@"error: JUB_GPC_OpenSecureChannel");
        return NO;
    }
    NSLog(@"OKNFC: openChannel success.");
    return YES;
}

+ (BOOL)JUB_GPC_Initialize:(NSData *)cert {
    JUB_RV rv = JUBR_ERROR;
    JUB_ULONG tag = 0;
    JUB_CHAR_PTR value;
    JUB_CHAR_CPTR c_data = [[cert toHexString] UTF8String];

    rv = JUB_GPC_TLVDecode(c_data, &tag, &value);
    if (JUBR_OK != rv) {
        return NO;
    }

    JUB_CHAR_PTR sn = nullptr;
    JUB_CHAR_PTR subjectID = nullptr;
    rv = JUB_GPC_ParseCertificate(value, &sn, &subjectID);
    if (JUBR_OK != rv) {
        return NO;
    }

    NSLog(@"OKNFC: subjectID: %s",subjectID);
    GPC_SCP11_SHAREDINFO shareInfo;
    shareInfo.scpID = (char *)"1107";
    shareInfo.keyUsage = (char *)"3C";
    shareInfo.keyType = (char *)"88";
    shareInfo.keyLength = (char *)"10";
    shareInfo.hostID = (char *)"8080808080808080";
    shareInfo.cardGroupID = subjectID;

    // initParams.json -> sk
    char *sk = (char *)[[NFCConfig envFor:@"NFCSK"] UTF8String];
    rv = JUB_GPC_Initialize(shareInfo, LITE_CERT.UTF8String, sk);

    if (JUBR_OK != rv) {
        return NO;
    }

    NSLog(@"OKNFC: JUB_GPC_Initialize OK.");
    return YES;
}

+ (BOOL)verifySN:(NSString *)cardSN withCert:(NSData *)cert {
    JUB_RV rv = JUBR_ERROR;
    JUB_ULONG tag = 0;
    JUB_CHAR_PTR value;
    JUB_CHAR_CPTR c_data = [[cert toHexString] UTF8String];

    rv = JUB_GPC_TLVDecode(c_data, &tag, &value);
    if (JUBR_OK != rv) {
        return NO;
    }

    JUB_CHAR_PTR sn = nullptr;
    JUB_CHAR_PTR subjectID = nullptr;
    rv = JUB_GPC_ParseCertificate(value, &sn, &subjectID);
    if (JUBR_OK != rv) {
        return NO;
    }

    NSString *certSN = [NSString stringWithCString:sn encoding:NSUTF8StringEncoding];

    BOOL identical = [certSN isEqualToString:cardSN];

    NSLog(@"OKNFC: certSN: %@; cardSN: %@; identical: %@",certSN, cardSN, identical ? @"YES✅" : @"NO❌");
    return identical;
}

+ (NFCISO7816APDU *)selectSecure {
    return [OKNFCBridge buildAPDUWithStr:@"0x00a4040008A000000151000000"];
}

+ (NFCISO7816APDU *)selectBackup {
    return [OKNFCBridge buildAPDUWithStr:@"0x00a4040008D156000132834001"];
}

+ (NFCISO7816APDU *)getCardSN {
    return [OKNFCBridge buildAPDUWithStr:@"0x80CB800005DFFF028101"];
}

+ (NFCISO7816APDU *)getCardCert {
    return [OKNFCBridge buildAPDUWithStr:@"0x80CABF2106A60483021518"];
}

+ (NFCISO7816APDU *)getBackupStatus {
    return [OKNFCBridge buildAPDUWithStr:@"0x806a0000"];
}

+ (NFCISO7816APDU *)getPINStatus {
    return [OKNFCBridge buildAPDUWithStr:@"0x80CB800005DFFF028105"];
}

+ (NFCISO7816APDU *)setPIN:(NSString *)pin {
    NSString *dataStr = [NSString stringWithFormat:@"DFFE0B8204080006%@", pin.hexString];
    NSLog(@"datastr %@",dataStr);
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:dataStr encrypt:YES];
}

+ (NFCISO7816APDU *)changePIN:(NSString *)oldPin newPin:(NSString *)newPin {
    NSString *dataStr = [NSString stringWithFormat:@"DFFE0B82040e06%@06%@", oldPin.hexString, newPin.hexString];
    NSLog(@"datastr %@",dataStr);

    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:dataStr encrypt:YES];
}

+ (NFCISO7816APDU *)verifyPIN:(NSString *)pin {
    NSString *hexPin = [@"06" stringByAppendingString: [pin hexString]];
    NSLog(@"hexPin %@", hexPin);
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0x20 p1:0x00 p2:0x00 data:hexPin encrypt:YES];
}

+ (NFCISO7816APDU *)importMnemonic:(NSString *)mnemonic {

    /// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/10551684/Lite
    return [OKNFCBridge buildAPDUWithStr:[@"0x803B0000XX" stringByAppendingString:mnemonic]];
}

+ (NFCISO7816APDU *)exportMnemonic {
    return [OKNFCBridge buildAPDUWithStr:@"0x804B0000"];
}

+ (NFCISO7816APDU *)pinRTL {
    return [OKNFCBridge buildAPDUWithStr:@"0x80cb800005dfff028102"];
}

+ (NFCISO7816APDU *)wipeCard {
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:@"dffe028205" encrypt:YES];
}

+ (NFCISO7816APDU *)openChannel_1 {
    return [OKNFCBridge buildAPDUWithStr:[@"0x802a1810XX" stringByAppendingString:LITE_CERT]];
}

+ (NFCISO7816APDU *)openChannel_2 {
    return [OKNFCBridge buildAPDUWithStr:[@"0x80821815XX" stringByAppendingString:[OKNFCBridge mutualAuthData]]];
}
@end
