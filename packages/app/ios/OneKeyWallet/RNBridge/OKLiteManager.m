//
//  RNEventManager.m
//  exponfcdemo
//
//  Created by 林雷钦 on 2021/11/8.
//

#import "OKLiteManager.h"
#import "RNLiteCallBackManager.h"
#import "ReactNativeConfig.h"

@implementation OKLiteManager


RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getCardName:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager getCardName:callback];
  }
}

RCT_EXPORT_METHOD(getLiteInfo:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager getLiteInfo:callback];
  }
}

RCT_EXPORT_METHOD(setMnemonic:(NSString *)mnemonic pin:(NSString *)pin overwrite:(BOOL)overwrite callback:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager setMnemonic:mnemonic withPin:pin overwrite:overwrite callBack:callback];
  }
}

RCT_EXPORT_METHOD(getMnemonicWithPin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager getMnemonicWithPin:pin callBack:callback];
  }
}

RCT_EXPORT_METHOD(changePin:(NSString *)oldPwd newPwd:(NSString *)newPwd callback:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager changePin:oldPwd newPwd:newPwd callBack:callback];
  }
}
RCT_EXPORT_METHOD(reset:(RCTResponseSenderBlock)callback)
{
  if ([OKLiteManager checkSDKVaild:callback]) {
    [RNLiteCallBackManager reset:callback];
  }
}

+ (BOOL)checkSDKVaild:(RCTResponseSenderBlock)callback {
  if ([ReactNativeConfig envFor:@"LITE_CERT"].length > 0 && [ReactNativeConfig envFor:@"NFCSK"].length > 0) {
    return YES;
  }
  callback(@[@{@"code":@(NFCLiteExceptionsInitChannel),@"message":@""},[NSNull null],[NSNull null]]);
  return NO;
}


@end
