//
//  OKLiteCommandModal.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/6/27.
//

#import "OKLiteCommandModal.h"
#import "OKNFCBridge.h"
#import "OKLiteCommandTool.h"
#import "NFCConfig.h"

@interface OKLiteCommandModal ()

@property(nonatomic,assign)OKNFCLiteVersion version;

@end

@implementation OKLiteCommandModal

- (instancetype)initWithCommand:(OKLiteCommand)command version:(OKNFCLiteVersion)version {
    self = [super init];
    if (!self) return self;
    _command = command;
    _version = version;
//    _app = [OKLiteCommandTool getLiteAppWithCommand:command version:version];
    _parseResp = NO;
    [self initDesc];
    return self;
}

- (void)initDesc {
    switch (_command) {
        case OKLiteCommandSelectSecure:
            self.desc = @"设置:主安全域";
            break;
        case OKLiteCommandSelectBackup:
            self.desc = @"设置:备份应用";
            break;
        case OKLiteCommandGetCardSN:
            self.desc = @"获取SN";
            break;
        case OKLiteCommandGetCardCert:
            self.desc = @"获取设备证书";
            break;
        case OKLiteCommandGetBackupStatus:
            self.desc = @"是否存在备份";
            break;
        case OKLiteCommandGetPINStatus:
            self.desc = @"是否设置 PIN";
            break;
        case OKLiteCommandExportMnemonic:
            self.desc = @"导出数据";
            break;
        case OKLiteCommandImportMnemonic:
            self.desc = @"备份数据";
            break;
        case OKLiteCommandPinRTL:
            self.desc = @"获取密码的重试次数";
            break;
        case OKLiteCommandWipeCard:
            self.desc = @"重置卡片";
            break;
        case OKLiteCommandOpenChannel_1:
            self.desc = @"开启安全通道:verify_certificate";
            break;
        case OKLiteCommandOpenChannel_2:
            self.desc = @"开启安全通道:verify_auth_data";
            break;
        case OKLiteCommandSetPIN:
            self.desc = @"设置Pin";
            break;
        case OKLiteCommandChangePIN:
            self.desc = @"修改 Pin";
            break;
        case OKLiteCommandVerifyPIN:
            self.desc = @"验证 Pin";
            break;
    }
}

- (NFCISO7816APDU *)buildAPDU {
    switch (_command) {
        case OKLiteCommandSelectSecure:
            return [OKNFCBridge buildAPDUWithStr:@"0x00a4040008A000000151000000" encrypt:NO];
        case OKLiteCommandSelectBackup:
            if (_version == OKNFCLiteVersionV2) {
                return [OKNFCBridge buildAPDUWithStr:@"0x00a404000e6f6e656b65792e6261636b757001" encrypt:NO];
            } else {
                return [OKNFCBridge buildAPDUWithStr:@"0x00a4040008D156000132834001" encrypt:NO];
            }
        case OKLiteCommandGetCardSN:
            return [OKNFCBridge buildAPDUWithStr:@"0x80CB800005DFFF028101" encrypt:NO];
        case OKLiteCommandGetCardCert:
            return [OKNFCBridge buildAPDUWithStr:@"0x80CABF2106A60483021518" encrypt:NO];
        case OKLiteCommandGetBackupStatus:
            return [OKNFCBridge buildAPDUWithStr:@"0x806a0000" encrypt:NO];
        case OKLiteCommandGetPINStatus:
            return [OKNFCBridge buildAPDUWithStr:@"0x80CB800005DFFF028105" encrypt:NO];
        case OKLiteCommandExportMnemonic:
            if (_version == OKNFCLiteVersionV2) {
                return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0x4b p1:0x00 p2:0x00 data:@"" encrypt:YES];
            } else {
                return [OKNFCBridge buildAPDUWithStr:@"0x804B0000" encrypt:NO];
            }
        case OKLiteCommandPinRTL:
            return [OKNFCBridge buildAPDUWithStr:@"0x80cb800005dfff028102" encrypt:NO];
        case OKLiteCommandWipeCard:
            return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:@"dffe028205" encrypt:YES];
        case OKLiteCommandOpenChannel_1:
            return [OKNFCBridge buildAPDUWithStr:[@"0x802a1810XX" stringByAppendingString:[NFCConfig envFor:@"LITE_CERT"]] encrypt:NO];
        case OKLiteCommandOpenChannel_2:
            return [OKNFCBridge buildAPDUWithStr:[@"0x80821815XX" stringByAppendingString:[OKNFCBridge mutualAuthData]] encrypt:NO];
        default:
            return nil;
    }
}

- (NFCISO7816APDU *)setPIN:(NSString *)pin {
    NSString *dataStr = [NSString stringWithFormat:@"DFFE0B8204080006%@", pin.hexString];
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:dataStr encrypt:YES];
}

- (NFCISO7816APDU *)changePIN:(NSString *)oldPin newPin:(NSString *)newPin {
    NSString *dataStr = [NSString stringWithFormat:@"DFFE0B82040e06%@06%@", oldPin.hexString, newPin.hexString];
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0xcb p1:0x80 p2:0x00 data:dataStr encrypt:YES];
}

- (NFCISO7816APDU *)verifyPIN:(NSString *)pin {
    NSString *hexPin = [@"06" stringByAppendingString: [pin hexString]];
    return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0x20 p1:0x00 p2:0x00 data:hexPin encrypt:YES];
}

- (NFCISO7816APDU *)importMnemonic:(NSString *)mnemonic {
    /// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/10551684/Lite
    if (_version == OKNFCLiteVersionV2) {
        return [OKNFCBridge buildAPDUWith_cla:0x80 ins:0x3B p1:0x00 p2:0x00 data:mnemonic encrypt:YES];
    } else {
        return [OKNFCBridge buildAPDUWithStr:[@"0x803B0000XX" stringByAppendingString:mnemonic] encrypt:NO];
    }
}

@end
