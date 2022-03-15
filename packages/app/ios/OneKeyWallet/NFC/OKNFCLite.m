//
//  OKNFCLite.m
//  OKNFC
//
//  Created by zj on 2021/5/1.
//

#import "OKNFCLite.h"
#import "OKNFCBridge.h"
#import "OKNFCUtility.h"
#import <CoreNFC/CoreNFC.h>
//#import "OKNFCHintViewController.h"
//#import "OKMnemonic.h"
#import "NSString+OKAdd.h"
#import "OKTools.h"

static const NSInteger OKNFC_PIN_LENGTH = 6;
static const NSInteger OKNFC_PIN_UNSET = -1;
static const NSInteger OKNFC_PIN_ERROR = -2;

typedef NS_ENUM(NSInteger, OKNFCLiteApp) {
    OKNFCLiteAppSecure, // 主安全域
    OKNFCLiteAppBackup, // 备份
};

typedef NS_ENUM(NSInteger, OKNFCLitePINVerifyResult) {
    OKNFCLitePINVerifyResultError = -1,
    OKNFCLitePINVerifyResultPass = 0,
    OKNFCLitePINVerifyResultNotMatch,
};

typedef NS_ENUM(NSInteger, OKNFCLiteChangePinResult) {
    OKNFCLiteChangePinResultError = -1,
    OKNFCLiteChangePinResultPass = 0,
    OKNFCLiteChangePinResultWiped,
};

@interface OKNFCLite() <NFCTagReaderSessionDelegate>
@property (nonatomic, strong) NFCTagReaderSession *session;
@property (nonatomic, copy) NSString *pin;
@property (nonatomic, copy) NSString *neoPin;
@property (nonatomic, copy) NSString *exportMnemonic;
@property (nonatomic, assign) BOOL certVerified;
@end

@implementation OKNFCLite

- (void)beginNewNFCSession {
    self.session = [[NFCTagReaderSession alloc] initWithPollingOption:NFCPollingISO14443 delegate:self queue:dispatch_get_global_queue(2, 0)];
    [self.session beginSession];
}

- (void)endNFCSessionWithError:(BOOL)isError {
    self.session.alertMessage = @"";
    if (isError) {
        
      [self.session invalidateSessionWithErrorMessage:OKTools.isChineseLan ? @"读取失败，请重试":@"Connect fail, please try again."];
    } else {
        [self.session invalidateSession];
    }
    self.session = nil;
}

- (void)getLiteInfo {
    if (self.SN.length > 0) {
        self.sessionType = OKNFCLiteSessionTypeUpdateInfo;
    } else {
        self.sessionType = OKNFCLiteSessionTypeGetInfo;
    }
    [self beginNewNFCSession];
}

- (void)_getLiteInfo {

    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag || ![self.delegate respondsToSelector:@selector(ok_lite:getInfoComplete:)]) { return; }

    OKNFCLiteStatus status = OKNFCLiteStatusError;
    self.pinRTL = 0;
    NSUInteger PinStatus = OKNFC_PIN_ERROR;

    if (![OKNFCLite selectNFCApp:OKNFCLiteAppSecure withTag:tag]) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self getInfoComplete:status];
        return;
    }

    NSString *liteSN = [OKNFCLite getSNWithTag:tag];
    if (self.sessionType == OKNFCLiteSessionTypeUpdateInfo) {
        if (!liteSN.length || ![liteSN isEqualToString:self.SN]) {
            [self endNFCSessionWithError:NO];
            [self.delegate ok_lite:self getInfoComplete:OKNFCLiteStatusSNNotMatch];
            return;
        }
    }

    self.SN = liteSN;
    if (!self.SN.length || ![self verifyCert]) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self getInfoComplete:status];
        return;
    }

    PinStatus = [OKNFCLite getPINStatusWithTag:tag];
    if (PinStatus == OKNFC_PIN_ERROR) {
        [self endNFCSessionWithError:NO];
        [self.delegate ok_lite:self getInfoComplete:status];
        return;
    }

    status = PinStatus == OKNFC_PIN_UNSET ? OKNFCLiteStatusNewCard : OKNFCLiteStatusActivated;
    self.status = status;
    self.pinRTL = PinStatus == OKNFC_PIN_UNSET ? 10 : PinStatus;

    [self endNFCSessionWithError:status == OKNFCLiteStatusError];
    [self.delegate ok_lite:self getInfoComplete:status];
}

- (BOOL)syncLiteInfo {
  id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];

  OKNFCLiteStatus status = OKNFCLiteStatusError;
  self.pinRTL = 0;
  NSUInteger PinStatus = OKNFC_PIN_ERROR;

  if (![OKNFCLite selectNFCApp:OKNFCLiteAppSecure withTag:tag]) {
      return NO;
  }
  NSString *liteSN = [OKNFCLite getSNWithTag:tag];
  self.SN = liteSN;
  if (!self.SN.length || ![self verifyCert]) {
      return NO;
  }
  PinStatus = [OKNFCLite getPINStatusWithTag:tag];
  status = PinStatus == OKNFC_PIN_UNSET ? OKNFCLiteStatusNewCard : OKNFCLiteStatusActivated;
  self.status = status;
  self.pinRTL = PinStatus == OKNFC_PIN_UNSET ? 10 : PinStatus;
  return YES;
}

- (void)setMnemonic:(NSString *)mnemonic withPin:(NSString *)pin overwrite:(BOOL)overwrite {
    if (pin.length != OKNFC_PIN_LENGTH) {
        return;
    }
    self.pin = pin;
    self.exportMnemonic = mnemonic;
    if(overwrite) {
      // 写入强制覆盖
      self.sessionType = OKNFCLiteSessionTypeSetMnemonicForce;
    } else {
      self.sessionType = OKNFCLiteSessionTypeSetMnemonic;
    }
    [self beginNewNFCSession];
}

- (void)_setMnemonic:(BOOL)force {

    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag || ![self.delegate respondsToSelector:@selector(ok_lite:setMnemonicComplete:)]) { return; }

    OKNFCLiteSetMncStatus status = OKNFCLiteSetMncStatusError;
  
    if (![self syncLiteInfo]) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self setMnemonicComplete:status];
        return;
    }
  
    if (self.status == OKNFCLiteStatusActivated && !force) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self setMnemonicComplete:status];
        return;
    }
  
    if (self.status == OKNFCLiteStatusNewCard) {
        [OKNFCLite openSecureChannelWithTag:tag];
        [OKNFCLite setPin:self.pin withTag:tag];
    }

    BOOL selectNFCAppSuccess = [OKNFCLite selectNFCApp:OKNFCLiteAppBackup withTag:tag];
    BOOL openSecureChannelSuccess2 = [OKNFCLite openSecureChannelWithTag:tag];

    if (selectNFCAppSuccess && openSecureChannelSuccess2) {
        OKNFCLitePINVerifyResult verifyResult = [self verifyPin:self.pin withTag:tag];
        if (verifyResult == OKNFCLitePINVerifyResultPass) {
            BOOL setMncSuccess = [OKNFCLite setMnc:self.exportMnemonic withTag:tag];
            status = setMncSuccess ? OKNFCLiteSetMncStatusSuccess : OKNFCLiteSetMncStatusError;

        } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
            status = OKNFCLiteSetMncStatusPinNotMatch;
            if (self.pinRTL <= 0) {
                BOOL restSeccuss = [self _resetSync];
                status = restSeccuss ? OKNFCLiteSetMncStatusWiped : OKNFCLiteSetMncStatusError;
            }
        }
    }
    if (status == OKNFCLiteSetMncStatusSuccess) {
        self.status = OKNFCLiteStatusActivated;
    } else if (status == OKNFCLiteSetMncStatusWiped) {
        self.status = OKNFCLiteStatusNewCard;
    }
    [self endNFCSessionWithError:status == OKNFCLiteSetMncStatusError];
    [self.delegate ok_lite:self setMnemonicComplete:status];
}

- (void)getMnemonicWithPin:(NSString *)pin {
    if (pin.length != OKNFC_PIN_LENGTH) {
        return;
    }
    self.pin = pin;
    self.sessionType = OKNFCLiteSessionTypeGetMnemonic;
    [self beginNewNFCSession];
}

- (void)_getMnemonic {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag || ![self.delegate respondsToSelector:@selector(ok_lite:getMnemonic:complete:)]) { return; }

    OKNFCLiteGetMncStatus status = OKNFCLiteGetMncStatusError;
    if (![self syncLiteInfo]) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self getMnemonic:nil complete:status];
        return;
    }
  
    if (self.status == OKNFCLiteStatusNewCard) {
        [self endNFCSessionWithError:YES];
        [self.delegate ok_lite:self getMnemonic:nil complete:status];
        return;
    }

    [OKNFCLite selectNFCApp:OKNFCLiteAppBackup withTag:tag];
    [OKNFCLite openSecureChannelWithTag:tag];

    NSString *mnc = nil;
    OKNFCLitePINVerifyResult verifyResult = [self verifyPin:self.pin withTag:tag];
    if (verifyResult == OKNFCLitePINVerifyResultPass) {
        mnc = [OKNFCLite getMncWithTag:tag];
        status = OKNFCLiteGetMncStatusSuccess;
    } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
        if (self.pinRTL <= 0) {
            BOOL restSeccuss = [self _resetSync];
            status = restSeccuss ? OKNFCLiteGetMncStatusWiped : OKNFCLiteGetMncStatusError;
        } else {
            status = OKNFCLiteGetMncStatusPinNotMatch;
        }
    }
    if (status == OKNFCLiteGetMncStatusWiped) {
        self.status = OKNFCLiteStatusNewCard;
    }
    [self endNFCSessionWithError:status == OKNFCLiteGetMncStatusError || status == OKNFCLiteGetMncStatusPinNotMatch];
    [self.delegate ok_lite:self getMnemonic:mnc complete:status];
}

- (void)changePin:(NSString *)oldPin to:(NSString *)newPin {
    self.pin = oldPin;
    self.neoPin = newPin;
    self.sessionType = OKNFCLiteSessionTypeChangePin;
    [self beginNewNFCSession];
}

- (void)_changePin {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag || !self.changePinCallback) {
        [self endNFCSessionWithError:YES];
        return;
    }

  if (![self syncLiteInfo]) {
      [self endNFCSessionWithError:YES];
      self.changePinCallback(OKNFCLiteChangePinStatusError);
      return;
  }
  
    if (self.status == OKNFCLiteStatusNewCard) {
        [self endNFCSessionWithError:YES];
        self.changePinCallback(OKNFCLiteChangePinStatusError);
        return;
    }

    if (![OKNFCLite openSecureChannelWithTag:tag]) {
        [self endNFCSessionWithError:YES];
        self.changePinCallback(OKNFCLiteChangePinStatusError);
        return;
    };

    OKNFCLiteChangePinResult changePinResult = [OKNFCLite setNewPin:self.neoPin withOldPin:self.pin withTag:tag];
    if (changePinResult == OKNFCLiteChangePinResultError) {
        [self syncLiteInfo];
        [self endNFCSessionWithError:YES];
        self.changePinCallback(OKNFCLiteChangePinStatusPinNotMatch);
        return;
    } else if (changePinResult == OKNFCLiteChangePinResultWiped) {
        [self endNFCSessionWithError:YES];
        self.changePinCallback(OKNFCLiteChangePinStatusWiped);
        return;
    }

    [self endNFCSessionWithError:NO];
    self.changePinCallback(OKNFCLiteChangePinStatusSuccess);
}

- (void)reset {
    self.sessionType = OKNFCLiteSessionTypeReset;
    [self beginNewNFCSession];
}

- (void)_reset {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag) { return; }

    [OKNFCLite selectNFCApp:OKNFCLiteAppSecure withTag:tag];
    if (!self.certVerified) {
        self.SN = [OKNFCLite getSNWithTag:tag];
        [self verifyCert];
    }
    [OKNFCLite openSecureChannelWithTag:tag];
    [tag sendCommandAPDU:OKNFCBridge.wipeCard completionHandler:^(NSData *responseData_2, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"wipeCard" response:responseData_2 sw1:sw1 sw2:sw2 error:error];
        if (self.resetCallback) {
            self.resetCallback(sw1 == OKNFC_SW1_OK,nil);
        }
        [self endNFCSessionWithError:sw1 != OKNFC_SW1_OK];
    }];
}

- (BOOL)_resetSync {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag) { return NO; }

    __block BOOL success = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [OKNFCLite selectNFCApp:OKNFCLiteAppSecure withTag:tag];
    if (!self.certVerified) {
        self.SN = [OKNFCLite getSNWithTag:tag];
        [self verifyCert];
    }
    [OKNFCLite openSecureChannelWithTag:tag];
    [tag sendCommandAPDU:OKNFCBridge.wipeCard completionHandler:^(NSData *responseData_2, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"wipeCard" response:responseData_2 sw1:sw1 sw2:sw2 error:error];
        success = sw1 == OKNFC_SW1_OK;
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return success;
}

+ (BOOL)selectNFCApp:(OKNFCLiteApp)app withTag:(id<NFCISO7816Tag>)tag {

    __block BOOL selectSuccess = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);
    NFCISO7816APDU *appAPDU = OKNFCBridge.selectSecure;
    NSString *appLog = @"设置主安全域";

    if (app == OKNFCLiteAppBackup) {
        appAPDU = OKNFCBridge.selectBackup;
        appLog = @"设置备份应用";
    }

    [tag sendCommandAPDU:appAPDU completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:appLog response:responseData sw1:sw1 sw2:sw2 error:error];
        selectSuccess = sw1 == OKNFC_SW1_OK;
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return selectSuccess;
}

+ (BOOL)openSecureChannelWithTag:(id<NFCISO7816Tag>)tag {
    __block BOOL success = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:OKNFCBridge.openChannel_1 completionHandler:^(NSData *responseData_1, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"openChannel phase 1" response:responseData_1 sw1:sw1 sw2:sw2 error:error];
        [tag sendCommandAPDU:OKNFCBridge.openChannel_2 completionHandler:^(NSData *responseData_2, uint8_t sw1, uint8_t sw2, NSError *error) {
            [OKNFCUtility logAPDU:@"openChannel phase 2" response:responseData_2 sw1:sw1 sw2:sw2 error:error];
            success = [OKNFCBridge openChannel:responseData_2];
            dispatch_semaphore_signal(sema);
        }];
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return success;
}

// 获取 SN
+ (NSString *)getSNWithTag:(id<NFCISO7816Tag>)tag {

    __block NSString *SN = nil;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:OKNFCBridge.getCardSN completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {

        [OKNFCUtility logAPDU:@"获取 SN" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            dispatch_semaphore_signal(sema);
            return;
        }

        SN = [[NSString alloc] initWithData:responseData encoding:NSUTF8StringEncoding];
        NSLog(@"OKNFC: 获取 SN 成功 SN = %@", SN);
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return SN;
}

// 获取证书 & 验证证书 & 初始化安全通道
- (BOOL)verifyCert {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag) { return NO; }

    if (!self.SN.length) {
        return NO;
    }

    __block BOOL isVerificationPass = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:OKNFCBridge.getCardCert completionHandler:^(NSData *certData, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"获取证书" response:certData sw1:sw1 sw2:sw2 error:error];
        isVerificationPass = YES;

        if (sw1 != OKNFC_SW1_OK) {
            NSLog(@"OKNFC: 获取证书失败");
            isVerificationPass = NO;
            dispatch_semaphore_signal(sema);
            return;
        }

        if (![OKNFCBridge verifySN:self.SN withCert:certData]) {
            NSLog(@"OKNFC: 验证证书失败");
            isVerificationPass = NO;
        }

        if (![OKNFCBridge JUB_GPC_Initialize:certData]) {
            NSLog(@"OKNFC: 初始化安全通道失败");
            isVerificationPass = NO;
        }

        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    self.certVerified = isVerificationPass;
    return isVerificationPass;
}

// 获取 PIN 状态，-1: 无pin，0~10: 剩余次数
+ (NSInteger)getPINStatusWithTag:(id<NFCISO7816Tag>)tag {

    __block NSInteger pinStatus = OKNFC_PIN_ERROR;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:OKNFCBridge.getPINStatus completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"获取 PIN 状态" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            NSLog(@"OKNFC: 获取 PIN 状态失败");
            dispatch_semaphore_signal(sema);
            return;
        }

        if (responseData.toHexString.intValue == 2) {
            NSLog(@"OKNFC: 未设置 PIN");
            pinStatus = OKNFC_PIN_UNSET;
            dispatch_semaphore_signal(sema);
            return;
        } else {
            [tag sendCommandAPDU:OKNFCBridge.pinRTL completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
                [OKNFCUtility logAPDU:@"获取 PIN RTL" response:responseData sw1:sw1 sw2:sw2 error:error];
                if (sw1 == OKNFC_SW1_OK) {
                    unsigned int outVal;
                    NSScanner* scanner = [NSScanner scannerWithString:responseData.toHexString];
                    [scanner scanHexInt:&outVal];
                    pinStatus = outVal;
                }
                dispatch_semaphore_signal(sema);
            }];
        }

    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return pinStatus;
}

+ (BOOL)setPin:(NSString *)pin withTag:(id<NFCISO7816Tag>)tag {

    __block BOOL success = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:[OKNFCBridge setPIN:pin] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {

        [OKNFCUtility logAPDU:@"设置 PIN" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            dispatch_semaphore_signal(sema);
            return;
        }

        NSLog(@"OKNFC: 成功设置 PIN = %@", pin);
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return success;
}

+ (OKNFCLiteChangePinResult)setNewPin:(NSString *)newPin withOldPin:(NSString *)oldPin withTag:(id<NFCISO7816Tag>)tag {

    __block OKNFCLiteChangePinResult result = OKNFCLiteChangePinResultError;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:[OKNFCBridge changePIN:oldPin newPin:newPin] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {

        [OKNFCUtility logAPDU:@"修改 PIN" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            if (sw1 == 0x63) {
                result = OKNFCLiteChangePinResultWiped;
            }
            dispatch_semaphore_signal(sema);
            return;
        }
        result = OKNFCLiteChangePinResultPass;
        NSLog(@"OKNFC: 成功修改 PIN = %@", newPin);
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return result;
}

- (OKNFCLitePINVerifyResult)verifyPin:(NSString *)pin withTag:(id<NFCISO7816Tag>)tag {

    static const u_int8_t AuthenticationLockCode = 0x69;
    static const u_int8_t FailedVerificationCode = 0x63;
    static const u_int8_t PinRTLBitMask = 0x0f;

    __block OKNFCLitePINVerifyResult result = OKNFCLitePINVerifyResultError;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:[OKNFCBridge verifyPIN:pin] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {

        [OKNFCUtility logAPDU:@"验证 PIN" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (error) {
          result = OKNFCLitePINVerifyResultError;
          dispatch_semaphore_signal(sema);
          return;
        }
        if (sw1 != OKNFC_SW1_OK) {
            if (sw1 == FailedVerificationCode) {
                self.pinRTL = sw2 & PinRTLBitMask;
            } else if (sw1 == AuthenticationLockCode) {
                self.pinRTL = 0;
            }
            result = OKNFCLitePINVerifyResultNotMatch;
            dispatch_semaphore_signal(sema);
            return;
        }
        self.pinRTL = 10;
        result = OKNFCLitePINVerifyResultPass;
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return result;
}

+ (BOOL)setMnc:(NSString *)mnc withTag:(id<NFCISO7816Tag>)tag {

    __block BOOL success = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:[OKNFCBridge importMnemonic:mnc] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {

        [OKNFCUtility logAPDU:@"设置助记词" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            dispatch_semaphore_signal(sema);
            return;
        }
        success = YES;
        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return success;
}

+ (NSString *)getMncWithTag:(id<NFCISO7816Tag>)tag {

    __block NSString *mnc = nil;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [tag sendCommandAPDU:[OKNFCBridge exportMnemonic] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"获取助记词" response:responseData sw1:sw1 sw2:sw2 error:error];
        if (sw1 != OKNFC_SW1_OK) {
            dispatch_semaphore_signal(sema);
            return;
        }

        /// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/10551684/Lite
        NSString *payload = responseData.toHexString;
        NSString *meta = [payload substringFromIndex:payload.length - 8].lowercaseString;
        NSString *dataStr = [[NSString alloc] initWithData:responseData encoding:NSUTF8StringEncoding];

        if ([meta ok_match:@"^ffff[a-f0-9]{4}$"]) {
            NSString *encoded_mnemonic = [payload substringToIndex:payload.length - 8];
            mnc = encoded_mnemonic;
//            mnc = [kPyCommandsManager callInterface:kInterface_decode_mnemonics parameter:@{@"encoded_mnemonics": encoded_mnemonic}];
//            if (![OKMnemonic isValidMnemonic:mnc] && [OKMnemonic isValidMnemonic:dataStr]) {
//                mnc = dataStr;
//            }
        } else {
            mnc = dataStr;
        }

        dispatch_semaphore_signal(sema);
    }];

    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    return mnc;
}


- (void)nfcSessionComplete:(NFCTagReaderSession *)session {
    switch (self.sessionType) {
        case OKNFCLiteSessionTypeGetInfo:
        case OKNFCLiteSessionTypeUpdateInfo:{
            [self _getLiteInfo];
        } break;
        case OKNFCLiteSessionTypeReset: {
            [self _reset];
        } break;
        case OKNFCLiteSessionTypeSetMnemonic: {
            [self _setMnemonic:NO];
        } break;
        case OKNFCLiteSessionTypeSetMnemonicForce: {
          [self _setMnemonic:YES];
        } break;
        case OKNFCLiteSessionTypeGetMnemonic: {
            [self _getMnemonic];
        } break;
        case OKNFCLiteSessionTypeChangePin: {
            [self _changePin];
        } break;
        default:
            break;
    }
    self.sessionType = OKNFCLiteSessionTypeNone;
}



- (void)tagReaderSession:(NFCTagReaderSession *)session didDetectTags:(NSArray<__kindof id<NFCTag>> *)tags {
    NSLog(@"OKNFC tagReaderSession didDetectTags %@", tags);

    id<NFCISO7816Tag> tag = [tags.firstObject asNFCISO7816Tag];
    if (!tag) { return; }

    [session connectToTag:tag completionHandler:^(NSError * _Nullable error) {
        if (error) {
            NSString *errMsg = [NSString stringWithFormat:@"OKNFC connectToTag %@", error];
            NSLog(@"%@", errMsg);
//            [kTools debugTipMessage:errMsg];
            [self endNFCSessionWithError:YES];
            return;
        }
        [self nfcSessionComplete:session];
    }];
}

- (void)tagReaderSession:(NFCTagReaderSession *)session didInvalidateWithError:(NSError *)error {
    NSLog(@"OKNFC tagReaderSession didInvalidateWithError %@", error);
    if (error.code == 200 || error.code == 6) {
      switch (self.sessionType) {
          case OKNFCLiteSessionTypeGetInfo:
          case OKNFCLiteSessionTypeUpdateInfo:{
            if ([self.delegate respondsToSelector:@selector(ok_lite:getInfoComplete:)]) {
              [self.delegate ok_lite:nil getInfoComplete:-1];
            }
          } break;
          case OKNFCLiteSessionTypeReset: {
            if (_resetCallback) {
              _resetCallback(NO,error);
            }
          } break;
          case OKNFCLiteSessionTypeSetMnemonic:
          case OKNFCLiteSessionTypeSetMnemonicForce: {
            if ([self.delegate respondsToSelector:@selector(ok_lite:setMnemonicComplete:)]) {
              [self.delegate ok_lite:nil setMnemonicComplete:-1];
            }
          } break;
          case OKNFCLiteSessionTypeGetMnemonic: {
            if ([self.delegate respondsToSelector:@selector(ok_lite:getMnemonic:complete:)]) {
              [self.delegate ok_lite:nil getMnemonic:nil complete:-1];
            }
          } break;
          case OKNFCLiteSessionTypeChangePin: {
            if (_changePinCallback) {
              _changePinCallback(OKNFCLiteChangePinStatusCancel);
            }
            
          } break;
          default:
              break;
      }
    }
    [session invalidateSession];
}

- (void)tagReaderSessionDidBecomeActive:(NFCTagReaderSession *)session {
    NSLog(@"OKNFC tagReaderSessionDidBecomeActive %@", session);
}

@end
