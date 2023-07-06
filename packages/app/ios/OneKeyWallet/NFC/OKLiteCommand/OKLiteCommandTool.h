//
//  OKLiteCommandTool.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import "OKNFCLiteDefine.h"
#import <CoreNFC/CoreNFC.h>
#import "OKLiteCommandModal.h"
#import "OKNFCManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface OKLiteCommandTool : NSObject

@property (nonatomic, weak) id<OKNFCManagerDelegate> delegate;

- (void)sendCommandWithAPDU:(NFCISO7816APDU *)apdu
                      modal:(OKLiteCommandModal *)modal
          completionHandler:(void(^)(NSData *responseData, uint8_t sw1, uint8_t sw2, NSError * _Nullable error, NSString *parseRespon))completionHandler;

//+ (OKNFCLiteApp)getLiteAppWithCommand:(OKLiteCommand)command version:(OKNFCLiteVersion)version;

@end

NS_ASSUME_NONNULL_END
