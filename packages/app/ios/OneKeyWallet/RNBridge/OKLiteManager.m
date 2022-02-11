//
//  RNEventManager.m
//  exponfcdemo
//
//  Created by 林雷钦 on 2021/11/8.
//

#import "OKLiteManager.h"
#import "RNLiteCallBackManager.h"

@implementation OKLiteManager


RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getCardName:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager getCardName:callback];
}

RCT_EXPORT_METHOD(getLiteInfo:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager getLiteInfo:callback];
}

RCT_EXPORT_METHOD(setMnemonic:(NSString *)mnemonic pin:(NSString *)pin overwrite:(BOOL)overwrite callback:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager setMnemonic:mnemonic withPin:pin overwrite:overwrite callBack:callback];
}

RCT_EXPORT_METHOD(getMnemonicWithPin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager getMnemonicWithPin:pin callBack:callback];
}

RCT_EXPORT_METHOD(changePin:(NSString *)oldPwd newPwd:(NSString *)newPwd callback:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager changePin:oldPwd newPwd:newPwd callBack:callback];
}
RCT_EXPORT_METHOD(reset:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager reset:callback];
}





@end
