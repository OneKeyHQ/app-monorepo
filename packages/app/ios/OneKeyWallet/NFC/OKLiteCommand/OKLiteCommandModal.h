//
//  OKLiteCommandModal.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import <CoreNFC/CoreNFC.h>
#import "OKNFCLiteDefine.h"

NS_ASSUME_NONNULL_BEGIN

typedef NFCISO7816APDU* _Nonnull (^BuildStrBlock)(void);


@interface OKLiteCommandModal : NSObject

@property (nonatomic,copy) NSString *desc;
@property(nonatomic,assign)OKLiteCommand command;

//@property (nonatomic,assign) OKNFCLiteApp app;
@property (nonatomic,assign) BOOL parseResp;

- (instancetype)initWithCommand:(OKLiteCommand)command version:(OKNFCLiteVersion)version;

- (NFCISO7816APDU *)buildAPDU;

- (NFCISO7816APDU *)setPIN:(NSString *)pin;

- (NFCISO7816APDU *)changePIN:(NSString *)oldPin newPin:(NSString *)newPin;

- (NFCISO7816APDU *)verifyPIN:(NSString *)pin;

- (NFCISO7816APDU *)importMnemonic:(NSString *)mnemonic;

@end

NS_ASSUME_NONNULL_END
