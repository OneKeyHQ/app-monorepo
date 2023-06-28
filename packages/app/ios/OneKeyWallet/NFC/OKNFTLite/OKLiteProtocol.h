//
//  OKLiteProtocol.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import "OKNFCLiteDefine.h"
#import <CoreNFC/CoreNFC.h>

NS_ASSUME_NONNULL_BEGIN

@protocol OKLiteProtocol <NSObject>

- (void)getLiteInfo:(GetLiteInfoCallback)callBack;

- (BOOL)syncLiteInfo;

- (void)setMnemonic:(NSString *)mnemonic
            withPin:(NSString *)pin
          overwrite:(BOOL)overwrite
           complete:(SetMnemonicCallback)complete;

- (void)reset:(ResetCallback)callBack;

- (BOOL)resetSync;

- (void)getMnemonicWithPin:(NSString *)pin complete:(GetMnemonicCallback)complete;

- (void)changePin:(NSString *)oldPin to:(NSString *)newPin complete:(ChangePinCallback)complete;

- (OKNFCLitePINVerifyResult)verifyPin:(NSString *)pin;

@end

NS_ASSUME_NONNULL_END
