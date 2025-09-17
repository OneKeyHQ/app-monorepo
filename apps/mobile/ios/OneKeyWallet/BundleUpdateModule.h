//
//  BundleUpdateModule.h
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface BundleUpdateModule : RCTEventEmitter <RCTBridgeModule>

+ (NSString *)downloadBundleDir;
+ (NSString *)bundleDir;

@end
