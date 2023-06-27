//
//  OKLiteV2.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import "OKLiteV2.h"
#import "OKLiteCommandTool.h"
#import "OKNFCUtility.h"

@interface OKLiteV2 ()

@end

@implementation OKLiteV2

- (instancetype)initWithDelegate:(id<OKNFCManagerDelegate>)delegate {
    self = [super initWithDelegate:delegate];
    if (!self) return self;
    self.version = OKNFCLiteVersionV2;
    return self;
}

#pragma mark - setMnemonic

- (void)setMnemonic:(NSString *)mnemonic
            withPin:(NSString *)pin
           complete:(SetMnemonicCallback)callBack {

    OKNFCLiteSetMncStatus status = OKNFCLiteSetMncStatusError;
    BOOL selectNFCAppSuccess = [self selectNFCAppWith:OKLiteCommandImportMnemonic];
    [self openSecureChannel];

    if (self.status == OKNFCLiteStatusActivated) {
        [self.delegate endNFCSessionWithError:YES];
        callBack(self,status);
        return;
    }

    if (self.status == OKNFCLiteStatusNewCard) {
        [self setPin:pin];
    }


    if (selectNFCAppSuccess) {
        OKNFCLitePINVerifyResult verifyResult = [self verifyPin:pin];
        if (verifyResult == OKNFCLitePINVerifyResultPass) {
            BOOL setMncSuccess = [self setMnc:mnemonic];
            status = setMncSuccess ? OKNFCLiteSetMncStatusSuccess : OKNFCLiteSetMncStatusError;
        } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
            status = OKNFCLiteSetMncStatusPinNotMatch;
            if (self.pinRTL <= 0) {
                BOOL restSeccuss = [self resetSync];
                status = restSeccuss ? OKNFCLiteSetMncStatusWiped : OKNFCLiteSetMncStatusError;
            }
        }
    }
    if (status == OKNFCLiteSetMncStatusSuccess) {
        self.status = OKNFCLiteStatusActivated;
    } else if (status == OKNFCLiteSetMncStatusWiped) {
        self.status = OKNFCLiteStatusNewCard;
    }
    [self.delegate endNFCSessionWithError:status != OKNFCLiteSetMncStatusSuccess];
    callBack(self,status);
}


- (void)setMnemonicOverWrite:(NSString *)mnemonic
            withPin:(NSString *)pin
           complete:(SetMnemonicCallback)callBack {
    OKNFCLiteSetMncStatus status = OKNFCLiteSetMncStatusError;

    BOOL selectNFCAppSuccess = [self selectNFCAppWith:OKLiteCommandImportMnemonic];
    BOOL openSecureChannelSuccess = [self openSecureChannel];
    if (selectNFCAppSuccess && openSecureChannelSuccess) {
        if (self.status == OKNFCLiteStatusNewCard) {
            [self setPin:pin];
        } else {
            OKNFCLitePINVerifyResult oldPinVerifyResult = [self verifyPin:pin];
            if (oldPinVerifyResult == OKNFCLitePINVerifyResultPass) {
                [self setPin:pin];
            } else if (oldPinVerifyResult == OKNFCLitePINVerifyResultNotMatch) {
                status = OKNFCLiteSetMncStatusPinNotMatch;
                if (self.pinRTL <= 0) {
                    BOOL restSeccuss = [self resetSync];
                    status = restSeccuss ? OKNFCLiteSetMncStatusWiped : OKNFCLiteSetMncStatusError;
                }
            }
        }

        OKNFCLitePINVerifyResult verifyResult = [self verifyPin:pin];
        if (verifyResult == OKNFCLitePINVerifyResultPass) {
            BOOL setMncSuccess = [self setMnc:mnemonic];
            status = setMncSuccess ? OKNFCLiteSetMncStatusSuccess : OKNFCLiteSetMncStatusError;
        } else if (verifyResult == OKNFCLitePINVerifyResultNotMatch) {
            status = OKNFCLiteSetMncStatusPinNotMatch;
            if (self.pinRTL <= 0) {
                BOOL restSeccuss = [self resetSync];
                status = restSeccuss ? OKNFCLiteSetMncStatusWiped : OKNFCLiteSetMncStatusError;
            }
        }
    }
    if (status == OKNFCLiteSetMncStatusSuccess) {
        self.status = OKNFCLiteStatusActivated;
    } else if (status == OKNFCLiteSetMncStatusWiped) {
        self.status = OKNFCLiteStatusNewCard;
    }
    [self.delegate endNFCSessionWithError:status != OKNFCLiteSetMncStatusSuccess];
    callBack(self,status);
}


- (void)setMnemonic:(NSString *)mnemonic
            withPin:(NSString *)pin
          overwrite:(BOOL)overwrite
           complete:(SetMnemonicCallback)callBack {

    if (![self syncLiteInfo]) {
        [self.delegate endNFCSessionWithError:YES];
        callBack(self,OKNFCLiteSetMncStatusError);
        return;
    }

    if (!overwrite) {
        [self setMnemonic:mnemonic withPin:pin complete:callBack];
    } else {
        [self setMnemonicOverWrite:mnemonic withPin:pin complete:callBack];
    }
}

@end
