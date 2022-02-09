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

+ (void)setMnemonic:(NSString *)mnemonic withPin:(NSString *)pin callBack:(RCTResponseSenderBlock)callBack {
  [[RNLiteCallBackManager sharedInstance].lite setMnemonic:mnemonic withPin:pin];
  [RNLiteCallBackManager sharedInstance].setMnemonicCallback = callBack;
}

- (void)ok_lite:(OKNFCLite *)lite setMnemonicComplete:(OKNFCLiteSetMncStatus)status {
  NSDictionary *cardInfo = [self cardInfo:lite status:status];
  switch (status) {
    case OKNFCLiteSetMncStatusSuccess:
      self.setMnemonicCallback(@[[NSNull null],@(true),cardInfo]);
      break;
    case OKNFCLiteSetMncStatusError:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteSetMncStatusSNNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteSetMncStatusPinNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteSetMncStatusWiped:
      self.setMnemonicCallback(@[[NSNull null],@(false),cardInfo]);
    default:
      break;
  }
  self.setMnemonicCallback = nil;
  return;
}

+ (void)getMnemonicWithPin:(NSString *)pin callBack:(RCTResponseSenderBlock)callBack {
  [[RNLiteCallBackManager sharedInstance].lite getMnemonicWithPin:pin];
  [RNLiteCallBackManager sharedInstance].getMnemonicCallback = callBack;
}

- (void)ok_lite:(OKNFCLite *)lite getMnemonic:(NSString *)mnemonic complete:(OKNFCLiteGetMncStatus)status {
  NSDictionary *cardInfo = [self cardInfo:lite status:status];
  switch (status) {
    case OKNFCLiteGetMncStatusSuccess:
      self.getMnemonicCallback(@[[NSNull null],@(true),cardInfo]);
      break;
    case OKNFCLiteGetMncStatusError:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteGetMncStatusSNNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteGetMncStatusPinNotMatch:
      self.setMnemonicCallback(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],[NSNull null]]);
    case OKNFCLiteGetMncStatusWiped:
      self.setMnemonicCallback(@[[NSNull null],@(false),cardInfo]);
    default:
      break;
  }
  self.setMnemonicCallback = nil;
  return;
}

+ (void)reset:(RCTResponseSenderBlock)callBack {
  [RNLiteCallBackManager clearLiteInfo];
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  [RNLiteCallBackManager sharedInstance].lite = lite;
  [[RNLiteCallBackManager sharedInstance].lite reset];
  [RNLiteCallBackManager sharedInstance].lite.resetCallback = ^(BOOL isSuccess) {
    if (isSuccess) {
      NSDictionary *cardInfo = [[RNLiteCallBackManager sharedInstance] cardInfo:lite status:0];
      callBack(@[[NSNull null],@(true),cardInfo]);
    } else {
      callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
    }
  };
}

- (id)cardInfo:(OKNFCLite *)lite status:(NSInteger)status {
  if (status == OKNFCLiteStatusSNNotMatch || status == OKNFCLiteStatusActivated || status == OKNFCLiteGetMncStatusSuccess || status == OKNFCLiteSetMncStatusSuccess) {
    return @{
      @"hasBackup":[NSNull null],
      @"pinRetryCount":@(lite.pinRTL),
      @"isNewCard":@(lite.status == OKNFCLiteStatusNewCard),
      @"serialNum":lite.SN
    };
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
