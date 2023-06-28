//
//  OKNFCLiteDefine.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import "NSString+OKNFCHexStr.h"
#import "NSData+OKNFCHexData.h"

typedef NS_ENUM(NSInteger, OKLiteCommand) {
    OKLiteCommandSelectSecure = 0,
    OKLiteCommandSelectBackup,
    OKLiteCommandGetCardSN,
    OKLiteCommandGetCardCert,
    OKLiteCommandGetBackupStatus,
    OKLiteCommandGetPINStatus,
    OKLiteCommandSetPIN,
    OKLiteCommandChangePIN,
    OKLiteCommandVerifyPIN,
    OKLiteCommandImportMnemonic,
    OKLiteCommandExportMnemonic,
    OKLiteCommandWipeCard,
    OKLiteCommandPinRTL,
    OKLiteCommandOpenChannel_1,
    OKLiteCommandOpenChannel_2,
};

typedef NS_ENUM(NSInteger, OKNFCLiteSessionType) {
    OKNFCLiteSessionTypeNone = 0,
    OKNFCLiteSessionTypeGetInfo,
    OKNFCLiteSessionTypeSetMnemonic,
    OKNFCLiteSessionTypeSetMnemonicForce,
    OKNFCLiteSessionTypeGetMnemonic,
    OKNFCLiteSessionTypeReset,
    OKNFCLiteSessionTypeUpdateInfo,
    OKNFCLiteSessionTypeChangePin,
};

typedef NS_ENUM(NSInteger, OKNFCLiteStatus) {
    OKNFCLiteStatusError = -1,
    OKNFCLiteStatusNewCard = 0,
    OKNFCLiteStatusActivated = 1,
    OKNFCLiteStatusSNNotMatch,
};

typedef NS_ENUM(NSInteger, OKNFCLiteSetMncStatus) {
    OKNFCLiteSetMncStatusError = -1,
    OKNFCLiteSetMncStatusSuccess = 0,
    OKNFCLiteSetMncStatusSNNotMatch,
    OKNFCLiteSetMncStatusPinNotMatch,
    OKNFCLiteSetMncStatusWiped,
    OKNFCLiteSetMncStatusCancel
};

typedef NS_ENUM(NSInteger, OKNFCLiteGetMncStatus) {
    OKNFCLiteGetMncStatusError = -1,
    OKNFCLiteGetMncStatusSuccess = 0,
    OKNFCLiteGetMncStatusSNNotMatch,
    OKNFCLiteGetMncStatusPinNotMatch,
    OKNFCLiteGetMncStatusWiped,
    OKNFCLiteGetMncStatusCancel,
};

typedef NS_ENUM(NSInteger, OKNFCLiteChangePinStatus) {
    OKNFCLiteChangePinStatusError = -1,
    OKNFCLiteChangePinStatusSuccess = 0,
    OKNFCLiteChangePinStatusSNNotMatch,
    OKNFCLiteChangePinStatusPinNotMatch,
    OKNFCLiteChangePinStatusWiped,
    OKNFCLiteChangePinStatusCancel,
};

@class OKLiteV1;
typedef void (^GetLiteInfoCallback)(OKLiteV1 *lite, OKNFCLiteStatus status);
typedef void (^ResetCallback)(OKLiteV1 *lite, BOOL isSuccess,NSError *error);
typedef void (^SetMnemonicCallback)(OKLiteV1 *lite, OKNFCLiteSetMncStatus status);
typedef void (^GetMnemonicCallback)(OKLiteV1 *lite, NSString*mnemonic, OKNFCLiteGetMncStatus status);
typedef void (^ChangePinCallback)(OKLiteV1 *lite, OKNFCLiteChangePinStatus status);

static const NSInteger OKNFC_PIN_LENGTH = 6;
static const NSInteger OKNFC_PIN_UNSET = -1;
static const NSInteger OKNFC_PIN_ERROR = -2;

typedef NS_ENUM(NSInteger, OKNFCLiteApp) {
    OKNFCLiteAppNONE = -1,
    OKNFCLiteAppSecure = 0, // 主安全域
    OKNFCLiteAppBackup = 1, // 备份
};

typedef NS_ENUM(NSInteger, OKNFCLitePINVerifyResult) {
    OKNFCLitePINVerifyResultError = -1,
    OKNFCLitePINVerifyResultPass = 0,
    OKNFCLitePINVerifyResultNotMatch,
};

typedef NS_ENUM(NSInteger, OKNFCLiteChangePinResult) {
    OKNFCLiteChangePinResultError = -1,
    OKNFCLiteChangePinResultPass = 0,
    OKNFCLiteChangePinResultWiped,
};

typedef NS_ENUM(NSInteger, OKNFCLiteVersion) {
    OKNFCLiteVersionV1 = 0,
    OKNFCLiteVersionV2 = 1,
};

