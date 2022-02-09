//
//  RNLiteCallBackManager.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/1/27.
//

#import <Foundation/Foundation.h>
#import "OKNFCLite.h"
#import <React/RCTBridgeModule.h>

typedef NS_ENUM(NSInteger, NFCLiteExceptions) {
  NFCLiteExceptionsInitChannel = 1000,// 初始化异常
  NFCLiteExceptionsNotExistsNFC = 1001,// 没有 NFC 设备
  NFCLiteExceptionsNotEnableNFC = 1002, // 没有开启 NFC 设备
  NFCLiteExceptionsNotNFCPermission = 1003,// 没有使用 NFC 的权限
  NFCLiteExceptionsConnectionFail = 2001,// 连接失败
  NFCLiteExceptionsInterrupt = 2002,// 操作中断（可能是连接问题）
  NFCLiteExceptionsDeviceMismatch = 2003,// 连接设备不匹配
  NFCLiteExceptionsPasswordWrong = 3001,// 密码错误
  NFCLiteExceptionsInputPasswordEmpty = 3002,// 输入密码为空
  NFCLiteExceptionsPasswordEmpty = 3003,// 未设置过密码
  NFCLiteExceptionsInitPassword = 3004,// 设置初始化密码错误
  NFCLiteExceptionsExecFailure = 4000,// 未知的命令执行失败
  NFCLiteExceptionsInitialized = 4001,// 已经备份过内容
  NFCLiteExceptionsNotInitialized = 4002,// 没有备份过内容
};


@interface RNLiteCallBackManager : NSObject<OKNFCLiteDelegate>

@property(nonatomic,copy)RCTResponseSenderBlock getCardNameCallback;
@property(nonatomic,copy)RCTResponseSenderBlock getLiteInfoCallback;
@property(nonatomic,copy)RCTResponseSenderBlock setMnemonicCallback;
@property(nonatomic,copy)RCTResponseSenderBlock getMnemonicCallback;

+ (instancetype)sharedInstance;


@end
