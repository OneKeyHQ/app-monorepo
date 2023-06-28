//
//  RNEventManager.m
//  OneKeyWallet
//
//  Created by linleiqin on 2021/11/8.
//

#import "OKLiteManager.h"
#import "NFCConfig.h"
#import "OKNFCManager.h"
#import "OKLiteV1.h"

typedef NS_ENUM(NSInteger, NFCLiteExceptions) {
  NFCLiteExceptionsInitChannel = 1000,// 初始化异常
  NFCLiteExceptionsNotExistsNFC = 1001,// 没有 NFC 设备
  NFCLiteExceptionsNotEnableNFC = 1002, // 没有开启 NFC 设备
  NFCLiteExceptionsNotNFCPermission = 1003,// 没有使用 NFC 的权限
  NFCLiteExceptionsConnectionFail = 2001,// 连接失败
  NFCLiteExceptionsInterrupt = 2002,// 操作中断（可能是连接问题）
  NFCLiteExceptionsDeviceMismatch = 2003,// 连接设备不匹配
  NFCLiteExceptionsUserCancel = 2004,// 用户取消连接
  NFCLiteExceptionsPasswordWrong = 3001,// 密码错误
  NFCLiteExceptionsInputPasswordEmpty = 3002,// 输入密码为空
  NFCLiteExceptionsPasswordEmpty = 3003,// 未设置过密码
  NFCLiteExceptionsInitPassword = 3004,// 设置初始化密码错误
  NFCLiteExceptionsCardLock = 3005,// 密码重试次数太多已经锁死
  NFCLiteExceptionsAutoReset = 3006,// 密码重试次数太多已经自动重制卡片
  NFCLiteExceptionsExecFailure = 4000,// 未知的命令执行失败
  NFCLiteExceptionsInitialized = 4001,// 已经备份过内容
  NFCLiteExceptionsNotInitialized = 4002,// 没有备份过内容
};

@implementation OKLiteManager


RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(checkNFCPermission:(RCTResponseSenderBlock)callback)
{
  BOOL permission = [NFCNDEFReaderSession readingAvailable];
  if (![NFCNDEFReaderSession readingAvailable]) {
    callback(@[[NSNull null],@(permission),[NSNull null]]);
  }
}

RCT_EXPORT_METHOD(getCardName:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager getLiteInfo:^(OKLiteV1 *lite, OKNFCLiteStatus status) {
      NSDictionary *cardInfo = [lite cardInfo];
      BOOL error = status == OKNFCLiteStatusError || status == OKNFCLiteStatusSNNotMatch;
      if (error) {
        callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
      } else {
        callBack(@[[NSNull null],lite.SN,cardInfo]);
      }
      liteManager = nil;
    }];
  }
}

RCT_EXPORT_METHOD(getLiteInfo:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager getLiteInfo:^(OKLiteV1 *lite, OKNFCLiteStatus status) {
      NSDictionary *cardInfo = [lite cardInfo];
      BOOL error = status == OKNFCLiteStatusError || status == OKNFCLiteStatusSNNotMatch;
      if (error) {
        callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
      } else {
        callBack(@[[NSNull null],cardInfo,cardInfo]);
      }
      liteManager = nil;
    }];
  }
}

RCT_EXPORT_METHOD(setMnemonic:(NSString *)mnemonic pin:(NSString *)pin overwrite:(BOOL)overwrite callback:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager setMnemonic:mnemonic withPin:pin overwrite:overwrite complete:^(OKLiteV1 *lite, OKNFCLiteSetMncStatus status) {
      NSDictionary *cardInfo = [lite cardInfo];
      switch (status) {
        case OKNFCLiteSetMncStatusSuccess:
          callBack(@[[NSNull null],@(true),cardInfo]);
          break;
        case OKNFCLiteSetMncStatusError:
          if (lite.status == OKNFCLiteStatusActivated) {
            callBack(@[@{@"code":@(NFCLiteExceptionsInitialized),@"message":@""},[NSNull null],[NSNull null]]);
          } else {
            callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
          }
          break;
        case OKNFCLiteSetMncStatusSNNotMatch:
          callBack(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        case OKNFCLiteSetMncStatusPinNotMatch:
          callBack(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],cardInfo]);
          break;
        case OKNFCLiteSetMncStatusWiped:
          callBack(@[@{@"code":@(NFCLiteExceptionsAutoReset),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        case OKNFCLiteSetMncStatusCancel:
          callBack(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        default:
          break;
      }
      liteManager = nil;
    }];
  }
}

RCT_EXPORT_METHOD(getMnemonicWithPin:(NSString *)pin callback:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager getMnemonicWithPin:pin complete:^(OKLiteV1 *lite, NSString *mnemonic, OKNFCLiteGetMncStatus status) {
      NSDictionary *cardInfo = [lite cardInfo];
      switch (status) {
        case OKNFCLiteGetMncStatusSuccess:
          if (mnemonic.length > 0) {
            callBack(@[[NSNull null],mnemonic,cardInfo]);
          }
          break;
        case OKNFCLiteGetMncStatusError:
          if (lite.status == OKNFCLiteStatusNewCard && lite.SN != nil) {
            callBack(@[@{@"code":@(NFCLiteExceptionsNotInitialized),@"message":@""},[NSNull null],[NSNull null]]);
          } else {
            callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
          }
          break;
        case OKNFCLiteGetMncStatusSNNotMatch:
          callBack(@[@{@"code":@(NFCLiteExceptionsDeviceMismatch),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        case OKNFCLiteGetMncStatusPinNotMatch:
          callBack(@[@{@"code":@(NFCLiteExceptionsPasswordWrong),@"message":@""},[NSNull null],cardInfo]);
          break;
        case OKNFCLiteGetMncStatusWiped:
          callBack(@[@{@"code":@(NFCLiteExceptionsAutoReset),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        case OKNFCLiteGetMncStatusCancel:
          callBack(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
          break;
        default:
          break;
      }
      liteManager = nil;
    }];
  }
}

RCT_EXPORT_METHOD(changePin:(NSString *)oldPwd newPwd:(NSString *)newPwd callback:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager changePin:oldPwd to:newPwd complete:^(OKLiteV1 *lite, OKNFCLiteChangePinStatus status) {
      NSDictionary *cardInfo = [lite cardInfo];
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
      liteManager = nil;
    }];
  }
}

RCT_EXPORT_METHOD(reset:(RCTResponseSenderBlock)callBack)
{
  if ([OKLiteManager checkSDKVaild:callBack]) {
    __block OKNFCManager *liteManager = [[OKNFCManager alloc] init];
    [liteManager reset:^(OKLiteV1 *lite, BOOL isSuccess, NSError *error) {
      if (isSuccess) {
        NSDictionary *cardInfo = [lite cardInfo];
        callBack(@[[NSNull null],@(true),cardInfo]);
      } else {
        if (error && error.code == 200) {
          callBack(@[@{@"code":@(NFCLiteExceptionsUserCancel),@"message":@""},[NSNull null],[NSNull null]]);
        } else {
          callBack(@[@{@"code":@(NFCLiteExceptionsConnectionFail),@"message":@""},[NSNull null],[NSNull null]]);
        }
      }
      liteManager = nil;
    }];
  }
}

+ (BOOL)checkSDKVaild:(RCTResponseSenderBlock)callback {
  if (![NFCNDEFReaderSession readingAvailable]) {
    callback(@[@{@"code":@(NFCLiteExceptionsNotNFCPermission),@"message":@""},[NSNull null],[NSNull null]]);
    return NO;
  }
  if ([NFCConfig envFor:@"LITE_CERT"].length > 0 && [NFCConfig envFor:@"NFCSK"].length > 0) {
    return YES;
  }
  callback(@[@{@"code":@(NFCLiteExceptionsInitChannel),@"message":@""},[NSNull null],[NSNull null]]);
  return NO;
}


@end
