  //
//  OKNFCLite.h
//  OKNFC
//
//  Created by zj on 2021/5/1.
//

#import <Foundation/Foundation.h>
#import <CoreNFC/CoreNFC.h>


#define OKLITEFOLDERNAME    @"OK_DEVICES_INFO_LITE"
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

@class OKNFCLite;
@protocol OKNFCLiteDelegate <NSObject>
@optional
- (void)ok_lite:(OKNFCLite *)lite getInfoComplete:(OKNFCLiteStatus)status;
- (void)ok_lite:(OKNFCLite *)lite setMnemonicComplete:(OKNFCLiteSetMncStatus)status;
- (void)ok_lite:(OKNFCLite *)lite getMnemonic:(NSString *)mnemonic complete:(OKNFCLiteGetMncStatus)status;
@end

@interface OKNFCLite : NSObject
@property (nonatomic, assign) OKNFCLiteSessionType sessionType;
@property (nonatomic, weak) id<OKNFCLiteDelegate> delegate;
@property (nonatomic, assign) NSUInteger pinRTL;
@property (nonatomic, assign) OKNFCLiteStatus status;
@property (nonatomic, copy) NSString *SN;

@property (nonatomic, copy) void(^changePinCallback)(OKNFCLiteChangePinStatus status);
@property (nonatomic, copy) void(^resetCallback)(BOOL isSuccess,NSError *error);

- (void)getLiteInfo;
- (void)reset;
- (void)setMnemonic:(NSString *)mnemonic withPin:(NSString *)pin overwrite:(BOOL)overwrite;
- (void)getMnemonicWithPin:(NSString *)pin;
- (void)changePin:(NSString *)oldPin to:(NSString *)newPin;

@end
