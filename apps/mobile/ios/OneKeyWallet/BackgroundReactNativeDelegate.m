#import "BackgroundReactNativeDelegate.h"
#import "BundleUpdateModule.h"
#import <React/RCTBridge.h>

const NSString *BACKGROUND_BUNDLE_NAME = @"background";
const NSString *BACKGROUND_BUNDLE_DEBUG_URL = @"http://localhost:8082/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable";

@implementation BackgroundReactNativeDelegate

// Mimic AppDelegate's ReactNativeDelegate logic in Objective-C
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
#if DEBUG
    return [NSURL URLWithString:BACKGROUND_BUNDLE_DEBUG_URL];
#else
    // Check for updated bundle in Documents directory first
    NSString *bundlePath = [BundleUpdateModule currentBundleMainJSBundle];
    if (bundlePath != nil) {
        return [NSURL URLWithString:bundlePath];
    }
    // Fallback to main bundle
    return [[NSBundle mainBundle] URLForResource:BACKGROUND_BUNDLE_NAME withExtension:@"jsbundle"];
#endif
}

- (NSURL *)bundleURL {
#if DEBUG
    return [NSURL URLWithString:BACKGROUND_BUNDLE_DEBUG_URL];
#else
    NSString *bundlePath = [BundleUpdateModule currentBundleMainJSBundle];
    if (bundlePath != nil) {
        return [NSURL URLWithString:bundlePath];
    }
    return [[NSBundle mainBundle] URLForResource:BACKGROUND_BUNDLE_NAME withExtension:@"jsbundle"];
#endif
}

@end

