//
//  RNLiteCallBackManager.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/1/27.
//

#import "RNLiteCallBackManager.h"

@interface RNLiteCallBackManager ()


@end

@implementation RNLiteCallBackManager

+ (instancetype)sharedInstance {
    static RNLiteCallBackManager *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[RNLiteCallBackManager alloc] init];
    });
    return instance;
}

#pragma mark - GetLiteInfo

+ (void)getCardName:(RCTResponseSenderBlock)callBack {
  [RNLiteCallBackManager clearLiteInfo];
  [[RNLiteCallBackManager sharedInstance].lite getLiteInfo];
  [RNLiteCallBackManager sharedInstance].getCardNameCallback = callBack;
}

+ (void)getLiteInfo:(RCTResponseSenderBlock)callBack {
  [RNLiteCallBackManager clearLiteInfo];
  [[RNLiteCallBackManager sharedInstance].lite getLiteInfo];
  [RNLiteCallBackManager sharedInstance].getLiteInfoCallback = callBack;
}

- (void)ok_lite:(OKNFCLite *)lite getInfoComplete:(OKNFCLiteStatus)status {
  BOOL error = status == OKNFCLiteStatusError || status == OKNFCLiteStatusSNNotMatch;
  NSDictionary *cardInfo = [self cardInfo:lite status:status];
  if (self.getCardNameCallback) {
    if (error) {
      self.getCardNameCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
    } else {
      self.getCardNameCallback(@[[NSNull null],lite.SN,cardInfo]);
    }
    self.getCardNameCallback = nil;
    return;
  }
  if (self.getLiteInfoCallback) {
    if (error) {
      self.getLiteInfoCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
    } else {
      self.getLiteInfoCallback(@[[NSNull null],cardInfo,cardInfo]);
    }
    self.getLiteInfoCallback = nil;
    return;
  }
}

#pragma mark - setMnemonic

+ (void)setMnemonic:(NSString *)mnemonic withPin:(NSString *)pin overwrite:(BOOL)overwrite callBack:(RCTResponseSenderBlock)callBack {
  [[RNLiteCallBackManager sharedInstance].lite setMnemonic:mnemonic withPin:pin overwrite:overwrite];
  [RNLiteCallBackManager sharedInstance].setMnemonicCallback = callBack;
}

- (void)ok_lite:(OKNFCLite *)lite setMnemonicComplete:(OKNFCLiteSetMncStatus)status {
  if (!self.setMnemonicCallback) {
    return;
  }
  if (lite != [RNLiteCallBackManager sharedInstance]->_lite) {
    return;
  }
  NSDictionary *cardInfo = [self cardInfo:lite status:status];
  switch (status) {
    case OKNFCLiteSetMncStatusSuccess:
      self.setMnemonicCallback(@[[NSNull null],@(true),cardInfo]);
      break;
    case OKNFCLiteSetMncStatusError:
      if (lite.status == OKNFCLiteStatusActivated) {
        self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsInitialized),@"message":@""},[NSNull null],[NSNull null]]);
      } else {
        self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
      }
      break;
    case OKNFCLiteSetMncStatusSNNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    case OKNFCLiteSetMncStatusPinNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],cardInfo]);
      break;
    case OKNFCLiteSetMncStatusWiped:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsAutoReset),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    case OKNFCLiteSetMncStatusCancel:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    default:
      break;
  }
  self.setMnemonicCallback = nil;
  [RNLiteCallBackManager clearLiteInfo];
  return;
}

+ (void)getMnemonicWithPin:(NSString *)pin callBack:(RCTResponseSenderBlock)callBack {
  [[RNLiteCallBackManager sharedInstance].lite getMnemonicWithPin:pin];
  [RNLiteCallBackManager sharedInstance].getMnemonicCallback = callBack;
}

- (void)ok_lite:(OKNFCLite *)lite getMnemonic:(NSString *)mnemonic complete:(OKNFCLiteGetMncStatus)status {
  if (!self.getMnemonicCallback) {
    return;
  }
  if (lite != [RNLiteCallBackManager sharedInstance]->_lite) {
    return;
  }
  NSDictionary *cardInfo = [self cardInfo:lite status:status];
  switch (status) {
    case OKNFCLiteGetMncStatusSuccess:
      if (mnemonic.length > 0) {
        self.getMnemonicCallback(@[[NSNull null],mnemonic,cardInfo]);
      }
      break;
    case OKNFCLiteGetMncStatusError:
      if (lite.status == OKNFCLiteStatusNewCard && lite.SN != nil) {
        self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsNotInitialized),@"message":@""},[NSNull null],[NSNull null]]);
      } else {
        self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
      }
      break;
    case OKNFCLiteGetMncStatusSNNotMatch:
      self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    case OKNFCLiteGetMncStatusPinNotMatch:
      self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],cardInfo]);
      break;
    case OKNFCLiteGetMncStatusWiped:
      self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsAutoReset),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    case OKNFCLiteGetMncStatusCancel:
      self.getMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
      break;
    default:
      break;
  }
  self.getMnemonicCallback = nil;
  [RNLiteCallBackManager clearLiteInfo];
  return;
}

+ (void)changePin:(NSString *)oldPwd newPwd:(NSString *)newPwd callBack:(RCTResponseSenderBlock)callBack {
  [RNLiteCallBackManager clearLiteInfo];
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  [RNLiteCallBackManager sharedInstance].lite = lite;
  [[RNLiteCallBackManager sharedInstance].lite changePin:oldPwd to:newPwd];
  [RNLiteCallBackManager sharedInstance].lite.changePinCallback = ^(OKNFCLiteChangePinStatus status) {
    NSDictionary *cardInfo = [[RNLiteCallBackManager sharedInstance] cardInfo:lite status:0];
    switch (status) {
        case OKNFCLiteChangePinStatusSuccess: {
          callBack(@[[NSNull null],@(true),cardInfo]);
        } break;
        case OKNFCLiteChangePinStatusWiped: {
          callBack(@[@{@"code":@(NFCLiteExceptionsAutoReset),@"message":@""},[NSNull null],[NSNull null]]);
        } break;
        case OKNFCLiteChangePinStatusPinNotMatch: {
          callBack(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],cardInfo]);
        } break;
        case OKNFCLiteChangePinStatusError: {
          if (lite.status == OKNFCLiteStatusNewCard && lite.SN != nil) {
              callBack(@[@{@"code":@(NFCLiteExceptionsNotInitialized),@"message":@""},[NSNull null],[NSNull null]]);
          } else {
            callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
          }
        } break;
        case OKNFCLiteChangePinStatusCancel: {
            callBack(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
        } break;
        default: break;
    }
    [RNLiteCallBackManager clearLiteInfo];
  };
}

+ (void)reset:(RCTResponseSenderBlock)callBack {
  [RNLiteCallBackManager clearLiteInfo];
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  [RNLiteCallBackManager sharedInstance].lite = lite;
  [[RNLiteCallBackManager sharedInstance].lite reset];
  [RNLiteCallBackManager sharedInstance].lite.resetCallback = ^(BOOL isSuccess, NSError *error) {
    if (isSuccess) {
      NSDictionary *cardInfo = [[RNLiteCallBackManager sharedInstance] cardInfo:lite status:0];
      callBack(@[[NSNull null],@(true),cardInfo]);
    } else {
      if (error && error.code == 200) {
        callBack(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
      } else {
        callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
      }
    }
    [RNLiteCallBackManager clearLiteInfo];
  };
}

- (id)cardInfo:(OKNFCLite *)lite status:(NSInteger)status {
  if (lite) {
    if (lite.SN && lite.pinRTL && lite.status) {
      return @{
        @"hasBackup":[NSNull null],
        @"pinRetryCount":@(lite.pinRTL),
        @"isNewCard":@(lite.status == OKNFCLiteStatusNewCard),
        @"serialNum":lite.SN
      };
    }
  }
  return [NSNull null];
}

- (OKNFCLite *)lite {
  if (!_lite) {
    _lite = [[OKNFCLite alloc] init];
    _lite.delegate = [RNLiteCallBackManager sharedInstance];
  }
  return _lite;
}

+ (void)clearLiteInfo {
  [RNLiteCallBackManager sharedInstance].lite = nil;
}

@end
