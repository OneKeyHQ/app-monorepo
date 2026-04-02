//
//  EntryBundleLoader.h
//  OneKeyWallet
//
//  ObjC++ helper that evaluates a secondary JS bundle inside an existing RCTHost's
//  Hermes runtime. Used for the common + entry split-bundle loading strategy:
//    1. RCTHost boots with common.jsbundle (polyfills + shared modules)
//    2. After the runtime is ready, this helper evaluates the entry-specific bundle
//       (main.jsbundle or background.bundle) via jsi::Runtime::evaluateJavaScript.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface EntryBundleLoader : NSObject

/// Evaluate a JS bundle file inside the given RCTHost's runtime.
/// @param bundlePath Absolute filesystem path to the bundle file.
/// @param host       The RCTHost whose runtime should evaluate the bundle.
///                   Internally accesses the private _instance ivar (RCTInstance)
///                   and calls callFunctionOnBufferedRuntimeExecutor:.
+ (void)loadEntryBundle:(NSString *)bundlePath inHost:(id)host;

@end

NS_ASSUME_NONNULL_END
