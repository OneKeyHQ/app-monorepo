//
//  Bridge.m
//  NFCTagReader
//
//  Created by zj on 2021/3/16.
//  Copyright © 2021 Apple. All rights reserved.
//

#import "OKNFCBridge.h"
#import "GPChannelSDKCore.h"
#import "OKNFCLiteDefine.h"
#import "NFCConfig.h"

@implementation OKNFCBridge

+ (NFCISO7816APDU *)buildAPDUWith_cla:(unsigned long)cla
                                  ins:(unsigned long)ins
                                   p1:(unsigned long)p1
                                   p2:(unsigned long)p2
                                 data:(NSString *)data
                              encrypt:(BOOL)encrypt {
    JUB_RV rv = JUBR_ERROR;
    JUB_CHAR_CPTR c_data = [data UTF8String];

    JUB_CHAR_PTR c_apdu = NULL;

    if (encrypt) {
        rv = JUB_GPC_BuildSafeAPDU(cla, ins, p1, p2, c_data, &c_apdu);
    } else {
        rv = JUB_GPC_BuildAPDU(cla, ins, p1, p2, c_data, &c_apdu);
    }

    if (JUBR_OK != rv) {
        return nil;
    }

    NSString *hexStr = [NSString stringWithCString:c_apdu encoding:NSUTF8StringEncoding];
    NSData *APDUData = [hexStr dataFromHexString];
    NFCISO7816APDU *apdu = [[NFCISO7816APDU alloc] initWithData:APDUData];
    return apdu;
}

+ (NSString *)parseSafeAPDUResponse:(NSData *)data sw1:(uint8_t)sw1 sw2:(uint8_t)sw2 {

    JUB_RV rv = JUBR_ERROR;

    NSMutableData *mutableRaw = [[NSMutableData alloc] initWithData:data];
    [mutableRaw appendBytes:&sw1 length:sizeof(sw1)];
    [mutableRaw appendBytes:&sw2 length:sizeof(sw2)];

    JUB_CHAR_CPTR c_data = [mutableRaw.toHexString UTF8String];

    JUB_UINT16 wRet = 0;
    JUB_CHAR_PTR pDecResp = nullptr;
    rv = JUB_GPC_ParseSafeAPDUResponse(c_data ,&wRet, &pDecResp);
    if (JUBR_OK != rv) {
        return nil;
    }

    NSString *resp = [NSString stringWithCString:pDecResp encoding:NSUTF8StringEncoding];
    JUB_FreeMemory(pDecResp);

    return resp;
}

+ (BOOL)parseAPDUResponse:(NSData *)data {

    JUB_RV rv = JUBR_ERROR;
    JUB_ULONG tag = 0;
    JUB_CHAR_PTR value;
    JUB_CHAR_CPTR c_data = [[data toHexString] UTF8String];

    rv = JUB_GPC_TLVDecode(c_data, &tag, &value);
    if (JUBR_OK != rv) {
        return NO;
    }

    JUB_UINT16 wRet = 0;
    JUB_CHAR_PTR pDecResp = nullptr;
    rv = JUB_GPC_ParseAPDUResponse(c_data,&wRet, &pDecResp);
    if (JUBR_OK != rv) {
        return NO;
    }

    JUB_FreeMemory(pDecResp);

    return YES;
}

+ (NFCISO7816APDU *)buildAPDUWithStr:(NSString *)str encrypt:(BOOL)encrypt {
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

    return [OKNFCBridge buildAPDUWith_cla:cla ins:ins p1:p1 p2:p2 data:data encrypt:encrypt];
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

    rv = JUB_GPC_Initialize(shareInfo, [NFCConfig envFor:@"LITE_CERT"].UTF8String, sk);

    if (JUBR_OK != rv) {
        return NO;
    }

    NSLog(@"OKNFC: JUB_GPC_Initialize OK.");
    return YES;
}

+ (void)closeSecureChannel {
    JUB_GPC_Finalize();
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

@end
