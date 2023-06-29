//
//  OKLiteV1.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import <Foundation/Foundation.h>
#import "OKLiteProtocol.h"
#import "OKNFCManager.h"
#import "OKNFCLiteDefine.h"
#import "OKNFCBridge.h"
#import "OKLiteCommandTool.h"


@interface OKLiteV1 : NSObject<OKLiteProtocol>
@property (nonatomic, copy) NSString *SN;
@property (nonatomic, assign) NSUInteger pinRTL;
@property (nonatomic, assign) OKNFCLiteStatus status;

@property (nonatomic, assign) OKNFCLiteVersion version;
@property (nonatomic, weak) id<OKNFCManagerDelegate> delegate;
@property (nonatomic, strong) OKLiteCommandTool *commandTool;


- (instancetype)initWithDelegate:(id<OKNFCManagerDelegate>)delegate;

- (BOOL)openSecureChannel;

- (BOOL)setPin:(NSString *)pin;

- (BOOL)setMnc:(NSString *)mnc;

- (BOOL)selectNFCAppWith:(OKLiteCommand)command;

- (BOOL)verifyCert;

- (id)cardInfo;

@end

