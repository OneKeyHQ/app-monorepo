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

RCT_EXPORT_METHOD(setMnemonic:(NSString *)mnemonic pin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager setMnemonic:mnemonic withPin:pin callBack:callback];
}

RCT_EXPORT_METHOD(getMnemonicWithPin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager getMnemonicWithPin:pin callBack:callback];
}

RCT_EXPORT_METHOD(reset:(RCTResponseSenderBlock)callback)
{
  [RNLiteCallBackManager reset:callback];
}





@end
