//
//  OKNFCManager.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import <CoreNFC/CoreNFC.h>
#import "OKNFCLiteDefine.h"

#define OKLITEFOLDERNAME    @"OK_DEVICES_INFO_LITE"


@protocol OKNFCManagerDelegate <NSObject>

- (id<NFCISO7816Tag>)getNFCsessionTag;

- (OKNFCLiteSessionType)getSessionType;

- (void)endNFCSessionWithError:(BOOL)isError;

@end

@interface OKNFCManager : NSObject

@property (nonatomic, assign) OKNFCLiteSessionType sessionType;

- (void)getLiteInfo:(GetLiteInfoCallback)callBack;

- (void)reset:(ResetCallback)callBack;

- (void)setMnemonic:(NSString *)mnemonic withPin:(NSString *)pin overwrite:(BOOL)overwrite complete:(SetMnemonicCallback)complete;

- (void)getMnemonicWithPin:(NSString *)pin complete:(GetMnemonicCallback)complete;

- (void)changePin:(NSString *)oldPin to:(NSString *)newPin complete:(ChangePinCallback)complete;


@end
