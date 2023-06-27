//
//  OKLiteCommandTool.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import "OKLiteCommandTool.h"
#import "OKNFCBridge.h"
#import "OKNFCUtility.h"

@implementation OKLiteCommandTool

- (void)sendCommandWithAPDU:(NFCISO7816APDU *)apdu
                  modal:(OKLiteCommandModal *)modal
      completionHandler:(void(^)(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString *parseRespon))completionHandler {

    id<NFCISO7816Tag> tag = [self.delegate getNFCsessionTag];
    [tag sendCommandAPDU:apdu completionHandler:^(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError *error) {
        NSString *parseRespon = nil;
        if(modal.parseResp && sw1 == OKNFC_SW1_OK) {
            parseRespon = [OKNFCBridge parseSafeAPDUResponse:responseData sw1:sw1 sw2:sw2];
        }

        [OKNFCUtility logAPDU:modal.desc response:responseData sw1:sw1 sw2:sw2 error:error];
        if (completionHandler) {
            completionHandler(responseData,sw1,sw2,error,parseRespon);
        }
    }];
}

//
//+ (OKNFCLiteApp)getLiteAppWithCommand:(OKLiteCommand)command version:(OKNFCLiteVersion)version {
//    switch (command) {
//        case OKLiteCommandGetCardSN:
//        case OKLiteCommandGetPINStatus:
//        case OKLiteCommandPinRTL:
//        case OKLiteCommandSetPIN:
//        case OKLiteCommandChangePIN:
//        case OKLiteCommandWipeCard:
//            return version == OKNFCLiteVersionV1 ? OKNFCLiteAppSecure : OKNFCLiteAppBackup;
//        case OKLiteCommandGetBackupStatus:
//        case OKLiteCommandVerifyPIN:
//        case OKLiteCommandImportMnemonic:
//        case OKLiteCommandExportMnemonic:
//            return OKNFCLiteAppBackup;
//        default:
//            return OKNFCLiteAppNONE;
//    }
//}


@end
