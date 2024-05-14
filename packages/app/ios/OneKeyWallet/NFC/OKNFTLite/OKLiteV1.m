//
//  OKLiteV1.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import "OKLiteV1.h"
#import "OKNFCUtility.h"
#import "OKLiteCommandModal.h"

@interface OKLiteV1()

@property (nonatomic, assign) BOOL certVerified;
@property (nonatomic, assign) BOOL inSecureChannel;

@property (nonatomic, assign) OKNFCLiteApp selectNFCApp;
@end


@implementation OKLiteV1
- (instancetype)initWithDelegate:(id<OKNFCManagerDelegate>)delegate {
  self = [super init];
  if (!self) return self;
  _delegate = delegate;
  _version = OKNFCLiteVersionV1;
  _commandTool = [[OKLiteCommandTool alloc] init];
  _commandTool.delegate = delegate;
  return self;
}

- (id<NFCISO7816Tag>)getTag {
  id<NFCISO7816Tag> tag = [self.delegate getNFCsessionTag];
  if (!tag) {
    [self.delegate endNFCSessionWithError:YES];
    return nil;
  }
  return tag;
}

- (id)cardInfo {
   if (_SN && _pinRTL && _status) {
     return @{
       @"hasBackup":[NSNull null],
       @"pinRetryCount":@(_pinRTL),
       @"isNewCard":@(_status == OKNFCLiteStatusNewCard),
       @"serialNum":_SN
     };
   }
  return [NSNull null];
}

#pragma mark - getLiteInfo

- (void)getLiteInfo:(GetLiteInfoCallback)callback {

  OKNFCLiteStatus status = OKNFCLiteStatusError;
  self.pinRTL = 0;
  NSUInteger PinStatus = OKNFC_PIN_ERROR;

  if (![self selectNFCAppWith:OKLiteCommandGetCardSN]) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,status);
    return;
  }

  NSString *liteSN = [self getSN];
  if ([self.delegate getSessionType] == OKNFCLiteSessionTypeUpdateInfo) {
    if (!liteSN.length || ![liteSN isEqualToString:self.SN]) {
      [self.delegate endNFCSessionWithError:NO];
      callback(self,status);
      return;
    }
  }

  self.SN = liteSN;
  if (!self.SN.length || ![self verifyCert]) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,status);
    return;
  }

  PinStatus = [self getPINStatus];
  if (PinStatus == OKNFC_PIN_ERROR) {
    [self.delegate endNFCSessionWithError:NO];
    callback(self,status);
    return;
  }

  status = PinStatus == OKNFC_PIN_UNSET ? OKNFCLiteStatusNewCard : OKNFCLiteStatusActivated;
  self.status = status;
  self.pinRTL = PinStatus == OKNFC_PIN_UNSET ? 10 : PinStatus;

  [self.delegate endNFCSessionWithError:status == OKNFCLiteStatusError];
  callback(self,status);
}

- (BOOL)syncLiteInfo {

  OKNFCLiteStatus status = OKNFCLiteStatusError;
  self.pinRTL = 0;
  NSUInteger PinStatus = OKNFC_PIN_ERROR;

  if (![self selectNFCAppWith:OKLiteCommandGetCardSN]) {
    return NO;
  }

  NSString *liteSN = [self getSN];
  self.SN = liteSN;
  if (!self.SN.length || ![self verifyCert]) {
    return NO;
  }
  PinStatus = [self getPINStatus];
  status = PinStatus == OKNFC_PIN_UNSET ? OKNFCLiteStatusNewCard : OKNFCLiteStatusActivated;
  self.status = status;
  self.pinRTL = PinStatus == OKNFC_PIN_UNSET ? 10 : PinStatus;
  return YES;
}

#pragma mark - setMnemonic

- (void)setMnemonic:(NSString *)mnemonic
            withPin:(NSString *)pin
          overwrite:(BOOL)overwrite
           complete:(SetMnemonicCallback)callBack {
  id<NFCISO7816Tag> tag = [self.delegate getNFCsessionTag];

  OKNFCLiteSetMncStatus status = OKNFCLiteSetMncStatusError;

  if (![self syncLiteInfo]) {
    [self.delegate endNFCSessionWithError:YES];
    callBack(self,status);
    return;
  }

  if (self.status == OKNFCLiteStatusActivated && !overwrite) {
    [self.delegate endNFCSessionWithError:YES];
    callBack(self,status);
    return;
  }

  if (self.status == OKNFCLiteStatusNewCard) {
    [self openSecureChannel];
    [self setPin:pin];
  }

  BOOL selectNFCAppSuccess = [self selectNFCAppWith:OKLiteCommandImportMnemonic];
  BOOL openSecureChannelSuccess2 = [self openSecureChannel];

  if (selectNFCAppSuccess && openSecureChannelSuccess2) {
    OKNFCLitePINVerifyResult verifyResult = [self verifyPin:pin];
    if (verifyResult == OKNFCLitePINVerifyResultPass) {
      BOOL setMncSuccess = [self setMnc:mnemonic];
      status = setMncSuccess ? OKNFCLiteSetMncStatusSuccess : OKNFCLiteSetMncStatusError;
    } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
      status = OKNFCLiteSetMncStatusPinNotMatch;
      if (self.pinRTL <= 0) {
        BOOL restSeccuss = [self resetSync];
        status = restSeccuss ? OKNFCLiteSetMncStatusWiped : OKNFCLiteSetMncStatusError;
      }
    }
  }
  if (status == OKNFCLiteSetMncStatusSuccess) {
    self.status = OKNFCLiteStatusActivated;
  } else if (status == OKNFCLiteSetMncStatusWiped) {
    self.status = OKNFCLiteStatusNewCard;
  }
  [self.delegate endNFCSessionWithError:status != OKNFCLiteSetMncStatusSuccess];
  callBack(self,status);
}


#pragma mark - reset

- (void)reset:(ResetCallback)callBack {
  if (![self selectNFCAppWith:OKLiteCommandWipeCard]) {
    [self.delegate endNFCSessionWithError:YES];
    callBack(self,false,nil);
    return;
  }

  if (![self verifyCert] || ![self openSecureChannel]) {
    [self.delegate endNFCSessionWithError:YES];
    callBack(self,false,nil);
    return;
  }

  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandWipeCard version:self.version];
  modal.parseResp = true;
  __weak typeof(self) weakSelf = self;
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    [weakSelf.delegate endNFCSessionWithError:sw1 != OKNFC_SW1_OK];
    if (callBack) {
      callBack(self,sw1 == OKNFC_SW1_OK,nil);
    }
  }];
}

- (BOOL)resetSync {
  __block BOOL success = NO;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);

  [self selectNFCAppWith:OKLiteCommandWipeCard];

  if (!self.certVerified) {
    self.SN = [self getSN];
    [self verifyCert];
  }
  [self openSecureChannel];
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandWipeCard version:self.version];
  modal.parseResp = true;
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    success = sw1 == OKNFC_SW1_OK;
    dispatch_semaphore_signal(sema);
  }];

  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  return success;
}

#pragma mark - getMnemonic

- (void)getMnemonicWithPin:(NSString *)pin complete:(GetMnemonicCallback)callback {
  OKNFCLiteGetMncStatus status = OKNFCLiteGetMncStatusError;
  if (![self syncLiteInfo]) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,nil,status);
    return;
  }

  if (self.status == OKNFCLiteStatusNewCard) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,nil,status);
    return;
  }

  BOOL selectNFCAppSuccess = [self selectNFCAppWith:OKLiteCommandExportMnemonic];;
  BOOL openSecureChannelSuccess2 = [self openSecureChannel];
  if (!selectNFCAppSuccess || !openSecureChannelSuccess2) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,nil,status);
    return;
  }

  NSString *mnc = nil;
  OKNFCLitePINVerifyResult verifyResult = [self verifyPin:pin];
  if (verifyResult == OKNFCLitePINVerifyResultPass) {
    mnc = [self getMnc];
    if (mnc) {
      status = OKNFCLiteGetMncStatusSuccess;
    }
  } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
    if (self.pinRTL <= 0) {
      BOOL restSeccuss = [self resetSync];
      status = restSeccuss ? OKNFCLiteGetMncStatusWiped : OKNFCLiteGetMncStatusError;
    } else {
      status = OKNFCLiteGetMncStatusPinNotMatch;
    }
  }
  if (status == OKNFCLiteGetMncStatusWiped) {
    self.status = OKNFCLiteStatusNewCard;
  }
  [self.delegate endNFCSessionWithError:status == OKNFCLiteGetMncStatusError || status == OKNFCLiteGetMncStatusPinNotMatch];
  callback(self,mnc,status);
}

#pragma mark - changePin

- (void)changePin:(NSString *)oldPin to:(NSString *)newPin complete:(ChangePinCallback)callback {
  if (![self syncLiteInfo]) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,OKNFCLiteChangePinStatusError);
    return;
  }

  if (self.status == OKNFCLiteStatusNewCard) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,OKNFCLiteChangePinStatusError);
    return;
  }

  if (![self openSecureChannel]) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,OKNFCLiteChangePinStatusError);
    return;
  };

  OKNFCLiteChangePinResult changePinResult = [self setNewPin:newPin withOldPin:oldPin];
  if (changePinResult == OKNFCLiteChangePinResultError) {
    if ([self syncLiteInfo]) {
      callback(self,self.pinRTL == 10 ? OKNFCLiteChangePinStatusWiped:OKNFCLiteChangePinStatusPinNotMatch);
    } else {
      callback(self,OKNFCLiteChangePinStatusError);
    }
    [self.delegate endNFCSessionWithError:YES];
    return;
  } else if (changePinResult == OKNFCLiteChangePinResultWiped) {
    [self.delegate endNFCSessionWithError:YES];
    callback(self,OKNFCLiteChangePinStatusWiped);
    return;
  }

  [self.delegate endNFCSessionWithError:NO];
  callback(self,OKNFCLiteChangePinStatusSuccess);
}


#pragma mark - OKNFCLiteAppBackup / OKNFCLiteAppSecure

-(OKNFCLiteApp)getLiteAppWithCommand:(OKLiteCommand)command {
  switch (command) {
    case OKLiteCommandGetCardSN:
    case OKLiteCommandGetPINStatus:
    case OKLiteCommandPinRTL:
    case OKLiteCommandSetPIN:
    case OKLiteCommandChangePIN:
    case OKLiteCommandWipeCard:
      return self.version == OKNFCLiteVersionV1 ? OKNFCLiteAppSecure : OKNFCLiteAppBackup;
    case OKLiteCommandGetBackupStatus:
    case OKLiteCommandVerifyPIN:
    case OKLiteCommandImportMnemonic:
    case OKLiteCommandExportMnemonic:
      return OKNFCLiteAppBackup;
    default:
      break;
  }
  return OKNFCLiteAppNONE;
}

- (BOOL)selectNFCAppWith:(OKLiteCommand)command {
  OKNFCLiteApp app = [self getLiteAppWithCommand:command];

  if(app != OKNFCLiteAppNONE) {
    __block BOOL selectSuccess = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);
    OKLiteCommand command = OKLiteCommandSelectSecure;
    if (app == OKNFCLiteAppBackup) {
      command = OKLiteCommandSelectBackup;
    }
    OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:command version:self.version];
    [self.commandTool sendCommandWithAPDU:[modal buildAPDU]
                                    modal:modal
                        completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
      selectSuccess = sw1 == OKNFC_SW1_OK;
      dispatch_semaphore_signal(sema);
    }];
    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
    if (selectSuccess) {
      self.selectNFCApp = app;
    } else {
      self.selectNFCApp = OKNFCLiteAppNONE;
    }
    return selectSuccess;
  }
  return true;

}

- (BOOL)openSecureChannel {
  __block BOOL success = NO;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal1 = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandOpenChannel_1 version:self.version];
  [self.commandTool sendCommandWithAPDU:[modal1 buildAPDU]
                                  modal:modal1
                      completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    OKLiteCommandModal *modal2 = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandOpenChannel_2 version:self.version];
    [self.commandTool sendCommandWithAPDU:[modal2 buildAPDU]
                                    modal:modal2
                        completionHandler:^(NSData * _Nonnull responseData_2, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
      success = [OKNFCBridge openChannel:responseData_2];
      dispatch_semaphore_signal(sema);
    }];
  }];
  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  return success;
}

#pragma mark - Commands

- (NSString *)getSN {
  __block NSString *SN = nil;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandGetCardSN version:self.version];
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString *parseRespon) {
    if (sw1 != OKNFC_SW1_OK) {
      dispatch_semaphore_signal(sema);
      return;
    }
    SN = [[NSString alloc] initWithData:responseData encoding:NSUTF8StringEncoding];
    dispatch_semaphore_signal(sema);
  }];
  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  return SN;
}

- (OKNFCLitePINVerifyResult)verifyPin:(NSString *)pin {

  static const u_int8_t AuthenticationLockCode = 0x69;
  static const u_int8_t FailedVerificationCode = 0x63;
  static const u_int8_t PinRTLBitMask = 0x0f;

  __block OKNFCLitePINVerifyResult result = OKNFCLitePINVerifyResultError;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandVerifyPIN version:self.version];
  modal.parseResp = true;
  [self.commandTool sendCommandWithAPDU:[modal verifyPIN:pin]
                                  modal:modal
                      completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString *parseRespon) {
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

//// 获取证书 & 验证证书 & 初始化安全通道
- (BOOL)verifyCert {
  if (self.certVerified) {
    return true;
  }

  if (!self.SN.length) {
    NSString *liteSN = [self getSN]
    ;
    self.SN = liteSN;
  }

  __block BOOL isVerificationPass = NO;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandGetCardCert version:self.version];
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU]
                                  modal:modal
                      completionHandler:^(NSData * _Nonnull certData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
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
- (NSInteger)getPINStatus {

  __block NSInteger pinStatus = OKNFC_PIN_ERROR;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);

  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandGetPINStatus version:self.version];
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU]
                                  modal:modal
                      completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
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
      OKLiteCommandModal *modal2 = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandPinRTL version:self.version];
      [self.commandTool sendCommandWithAPDU:[modal2 buildAPDU] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
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

- (BOOL)setMnc:(NSString *)mnc {
  __block BOOL success = NO;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandImportMnemonic version:self.version];
  modal.parseResp = true;
  [self.commandTool sendCommandWithAPDU:[modal importMnemonic:mnc] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
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

- (NSString *)getMnc {
  __weak typeof(self) weakSelf = self;
  __block NSString *mnc = nil;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandExportMnemonic version:self.version];
  modal.parseResp = true;
  [self.commandTool sendCommandWithAPDU:[modal buildAPDU] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    if (sw1 != OKNFC_SW1_OK) {
      dispatch_semaphore_signal(sema);
      return;
    }
    if (weakSelf.version == OKNFCLiteVersionV1) {
      /// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/10551684/Lite
      mnc = responseData.toHexString;
    } else {
      mnc = parseRespon;
    }
    dispatch_semaphore_signal(sema);
  }];

  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  return mnc;
}

- (BOOL)setPin:(NSString *)pin {

  __block BOOL success = NO;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandSetPIN version:self.version];
  modal.parseResp = self.version == OKNFCLiteVersionV2;

  [self.commandTool sendCommandWithAPDU:[modal setPIN:pin] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    if (sw1 != OKNFC_SW1_OK) {
      dispatch_semaphore_signal(sema);
      return;
    }
    success = YES;
    NSLog(@"OKNFC: 成功设置 PIN = %@", pin);
    dispatch_semaphore_signal(sema);
  }];

  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  return success;
}

- (OKNFCLiteChangePinResult)setNewPin:(NSString *)newPin withOldPin:(NSString *)oldPin {
  static const u_int8_t AuthenticationLockCode = 0x69;
  static const u_int8_t AuthenticationLockSw2Code = 0x83;
  static const u_int8_t FailedVerificationCode = 0x63;
  static const u_int8_t PinRTLBitMask = 0x0f;
  
  __block OKNFCLiteChangePinResult result = OKNFCLiteChangePinResultError;
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  OKLiteCommandModal *modal = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandChangePIN version:self.version];
  modal.parseResp = true;
  [self.commandTool sendCommandWithAPDU:[modal changePIN:oldPin newPin:newPin] modal:modal completionHandler:^(NSData * _Nonnull responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString * _Nonnull parseRespon) {
    if (sw1 != OKNFC_SW1_OK) {
      if (sw1 == FailedVerificationCode) {
        self.pinRTL = sw2 & PinRTLBitMask;
      } else if (sw1 == AuthenticationLockCode && sw2 == AuthenticationLockSw2Code) {
        self.pinRTL = 0;
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

@end

