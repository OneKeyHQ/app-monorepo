//
//  OKNFCManager.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import "OKNFCManager.h"
#import "OKNFCBridge.h"
#import "OKNFCUtility.h"
#import <CoreNFC/CoreNFC.h>
//#import "OKNFCHintViewController.h"
//#import "OKMnemonic.h"
#import "NSString+OKAdd.h"
#import "OKTools.h"
#import "OKLiteV1.h"
#import "OKLiteV2.h"
#import "OKLiteProtocol.h"
#import "OKLiteCommandModal.h"



#define kGetLiteInfoBlock    @"kGetLiteInfoBlock"
#define kSetMnemonicBlock    @"kSetMnemonicBlock"
#define kGetMnemonicBlock    @"kGetMnemonicBlock"
#define kChangePinBlock      @"kChangePinBlock"
#define kResetBlock          @"kResetBlock"




@interface OKNFCManager() <NFCTagReaderSessionDelegate,OKNFCManagerDelegate>
@property (nonatomic, strong) NFCTagReaderSession *session;
@property (nonatomic, copy) NSString *pin;
@property (nonatomic, copy) NSString *neoPin;
@property (nonatomic, copy) NSString *exportMnemonic;
@property (nonatomic, assign) BOOL certVerified;
@property (nonatomic, assign) OKNFCLiteApp selectNFCApp;
@property (nonatomic, strong) OKLiteV1 *lite;

@property (nonatomic, strong) NSMutableDictionary *completionBlocks;

@end

@implementation OKNFCManager

#pragma mark - OKNFCManagerDelegate

- (id<NFCISO7816Tag>)getNFCsessionTag {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    return tag;
}

- (OKNFCLiteSessionType)getSessionType {
    return self.sessionType;
}


- (void)endNFCSessionWithError:(BOOL)isError {
    self.session.alertMessage = @"";
    if (isError) {
        [self.session invalidateSessionWithErrorMessage:OKTools.isChineseLan ? @"读取失败，请重试":@"Connect fail, please try again."];
    } else {
        [self.session invalidateSession];
    }
    self.session = nil;
}


-(NSMutableDictionary *)completionBlocks {
    if (!_completionBlocks) {
        _completionBlocks = [NSMutableDictionary dictionary];
    }
    return _completionBlocks;
}

- (void)beginNewNFCSession {
    self.session = [[NFCTagReaderSession alloc] initWithPollingOption:NFCPollingISO14443 delegate:self queue:dispatch_get_global_queue(2, 0)];
    [self.session beginSession];
}

#pragma mark - NFCTagReaderSessionDelegate

- (void)tagReaderSession:(NFCTagReaderSession *)session didDetectTags:(NSArray<__kindof id<NFCTag>> *)tags {
    NSLog(@"OKNFC tagReaderSession didDetectTags %@", tags);

    id<NFCISO7816Tag> tag = [tags.firstObject asNFCISO7816Tag];
    if (!tag) { return; }

    [session connectToTag:tag completionHandler:^(NSError * _Nullable error) {
        if (error) {
            NSString *errMsg = [NSString stringWithFormat:@"OKNFC connectToTag %@", error];
            NSLog(@"%@", errMsg);
            //            [kTools debugTipMessage:errMsg];
            [self endNFCSessionWithError:YES];
            return;
        }
        [self nfcSessionComplete:session];
    }];
}

- (void)tagReaderSession:(NFCTagReaderSession *)session didInvalidateWithError:(NSError *)error {
    NSLog(@"OKNFC tagReaderSession didInvalidateWithError %@", error);
    if (error.code == 200 || error.code == 6) {
        switch (self.sessionType) {
            case OKNFCLiteSessionTypeGetInfo:
            case OKNFCLiteSessionTypeUpdateInfo:{
                GetLiteInfoCallback callback = [_completionBlocks objectForKey:kGetLiteInfoBlock];
                if(callback) {
                    callback(nil,OKNFCLiteStatusError);
                }
            } break;
            case OKNFCLiteSessionTypeReset: {
                ResetCallback callback = [_completionBlocks objectForKey:kResetBlock];
                if (callback) {
                    callback(self.lite, NO,error);
                }
            } break;
            case OKNFCLiteSessionTypeSetMnemonic:
            case OKNFCLiteSessionTypeSetMnemonicForce: {
                SetMnemonicCallback callback = [_completionBlocks objectForKey:kSetMnemonicBlock];
                if (callback) {
                    callback(self.lite,OKNFCLiteSetMncStatusCancel);
                }
            } break;
            case OKNFCLiteSessionTypeGetMnemonic: {
                GetMnemonicCallback callback = [_completionBlocks objectForKey:kGetMnemonicBlock];
                if (callback) {
                    callback(self.lite,nil,OKNFCLiteGetMncStatusCancel);
                }
            } break;
            case OKNFCLiteSessionTypeChangePin: {
                ChangePinCallback callback = [_completionBlocks objectForKey:kChangePinBlock];
                if (callback) {
                    callback(self.lite,OKNFCLiteChangePinStatusCancel);
                }

            } break;
            default:
                break;
        }
    }
    [session invalidateSession];
}

- (void)tagReaderSessionDidBecomeActive:(NFCTagReaderSession *)session {
    NSLog(@"OKNFC tagReaderSessionDidBecomeActive %@", session);
}

#pragma mark - Tasks

- (void)nfcSessionComplete:(NFCTagReaderSession *)session {
    if (![self checkLiteVersion]) {
        [self endNFCSessionWithError:YES];
    }
    self.selectNFCApp = OKNFCLiteAppNONE;
    switch (self.sessionType) {
        case OKNFCLiteSessionTypeGetInfo:
        case OKNFCLiteSessionTypeUpdateInfo:{
            [self _getLiteInfo];
        } break;
        case OKNFCLiteSessionTypeReset: {
            [self _reset];
        } break;
        case OKNFCLiteSessionTypeSetMnemonic: {
            [self _setMnemonic:NO];
        } break;
        case OKNFCLiteSessionTypeSetMnemonicForce: {
            [self _setMnemonic:YES];
        } break;
        case OKNFCLiteSessionTypeGetMnemonic: {
            [self _getMnemonic];
        } break;
        case OKNFCLiteSessionTypeChangePin: {
            [self _changePin];
        } break;
        default:
            break;
    }
    self.sessionType = OKNFCLiteSessionTypeNone;
}


#pragma mark - getLiteInfo

- (void)getLiteInfo:(GetLiteInfoCallback)callBack {
    if (self.lite.SN.length > 0) {
        self.sessionType = OKNFCLiteSessionTypeUpdateInfo;
    } else {
        self.sessionType = OKNFCLiteSessionTypeGetInfo;
    }
    [self.completionBlocks setObject:callBack forKey:kGetLiteInfoBlock];
    [self beginNewNFCSession];
}


- (void)getLiteInfo {
    if (self.lite.SN.length > 0) {
        self.sessionType = OKNFCLiteSessionTypeUpdateInfo;
    } else {
        self.sessionType = OKNFCLiteSessionTypeGetInfo;
    }
    [self beginNewNFCSession];
}

- (void)_getLiteInfo {
    GetLiteInfoCallback callback = [_completionBlocks objectForKey:kGetLiteInfoBlock];
    [self.lite getLiteInfo:callback];
}

- (BOOL)syncLiteInfo {
    return [self.lite syncLiteInfo];
}

#pragma mark - setMnemonic

- (void)setMnemonic:(NSString *)mnemonic
            withPin:(NSString *)pin
          overwrite:(BOOL)overwrite
           complete:(SetMnemonicCallback)complete {

    if (pin.length != OKNFC_PIN_LENGTH) {
        return;
    }
    self.pin = pin;
    self.exportMnemonic = mnemonic;
    if(overwrite) {
        // 写入强制覆盖
        self.sessionType = OKNFCLiteSessionTypeSetMnemonicForce;
    } else {
        self.sessionType = OKNFCLiteSessionTypeSetMnemonic;
    }
    [self.completionBlocks setObject:complete forKey:kSetMnemonicBlock];
    [self beginNewNFCSession];

}

- (void)_setMnemonic:(BOOL)force {
    SetMnemonicCallback callback = [_completionBlocks objectForKey:kSetMnemonicBlock];
    [self.lite setMnemonic:self.exportMnemonic withPin:self.pin overwrite:force complete:callback];
}

#pragma mark - getMnemonic

- (void)getMnemonicWithPin:(NSString *)pin complete:(GetMnemonicCallback)complete {
    if (pin.length != OKNFC_PIN_LENGTH) {
        return;
    }
    self.pin = pin;
    self.sessionType = OKNFCLiteSessionTypeGetMnemonic;
    [self.completionBlocks setObject:complete forKey:kGetMnemonicBlock];
    [self beginNewNFCSession];
}

- (void)_getMnemonic {
    GetMnemonicCallback callback = [_completionBlocks objectForKey:kGetMnemonicBlock];
    [self.lite getMnemonicWithPin:self.pin complete:callback];
}

#pragma mark - changePin

- (void)changePin:(NSString *)oldPin to:(NSString *)newPin complete:(ChangePinCallback)complete {
    self.pin = oldPin;
    self.neoPin = newPin;
    self.sessionType = OKNFCLiteSessionTypeChangePin;
    [self.completionBlocks setObject:complete forKey:kChangePinBlock];
    [self beginNewNFCSession];
}

- (void)_changePin {
    ChangePinCallback callback = [_completionBlocks objectForKey:kChangePinBlock];
    [self.lite changePin:self.pin to:self.neoPin complete:callback];
}

#pragma mark - reset

- (void)reset:(ResetCallback)callBack {
    self.sessionType = OKNFCLiteSessionTypeReset;
    [self.completionBlocks setObject:callBack forKey:kResetBlock];
    [self beginNewNFCSession];
}

- (void)_reset {
    ResetCallback callback = [_completionBlocks objectForKey:kResetBlock];
    [self.lite reset:callback];
}

- (BOOL)_resetSync {
    return [self.lite resetSync];
}


#pragma mark - CheckLiteVersion

-(BOOL)checkLiteVersion {
    id<NFCISO7816Tag> tag = [self.session.connectedTag asNFCISO7816Tag];
    if (!tag) { return false; }

    __block BOOL success = NO;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    OKLiteCommandModal *modalV1 = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandSelectBackup version:OKNFCLiteVersionV1];
    [tag sendCommandAPDU:[modalV1 buildAPDU] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
        [OKNFCUtility logAPDU:@"检查是否LiteV1" response:responseData sw1:sw1 sw2:sw2 error:error];
        success = sw1 == OKNFC_SW1_OK;

        dispatch_semaphore_signal(sema);
    }];
    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

    if(success) {
        self.lite = [[OKLiteV1 alloc] initWithDelegate:self];
    } else {
        OKLiteCommandModal *modalV2 = [[OKLiteCommandModal alloc] initWithCommand:OKLiteCommandSelectBackup version:OKNFCLiteVersionV2];
        [tag sendCommandAPDU:[modalV2 buildAPDU] completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
            [OKNFCUtility logAPDU:@"检查是否LiteV2" response:responseData sw1:sw1 sw2:sw2 error:error];
            success = sw1 == OKNFC_SW1_OK;
            dispatch_semaphore_signal(sema);
        }];
        dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
        if (success) {
            self.lite = [[OKLiteV2 alloc] initWithDelegate:self];
        }
    }

    return success;
}


@end
