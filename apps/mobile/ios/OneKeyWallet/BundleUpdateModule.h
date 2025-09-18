//
//  BundleUpdateModule.h
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface BundleUpdateModule : RCTEventEmitter <RCTBridgeModule>

- (BOOL)verifyBundleSHA256:(NSString *)bundlePath sha256:(NSString *)sha256;
- (NSString *)extractSHA256FromASCFile:(NSString *)ascPath;
+ (NSString *)downloadBundleDir;
+ (NSString *)bundleDir;
+ (BOOL)valiateAllFilesInDir:(NSString *)DirPath metadata:(NSDictionary *)metadata appVersion:(NSString *)appVersion bundleVersion:(NSString *)bundleVersion;
+ (NSString *)calculateSHA256:(NSString *)filePath;
+ (NSString *)currentBundleMainJSBundle;
+ (NSString *)currentBundleVersion;
+ (NSString *)currentBundleDir;
+ (NSDictionary *)currentMetadataJson;
+ (void)setCurrentBundleVersion:(NSString *)version;
@end
