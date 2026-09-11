//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

#import "JPUSHService.h"
#import "RCTJPushModule.h"

BOOL OneKeyIsTravelModeMaskingData(void);
BOOL OneKeyForceDisableTravelModeForRecovery(void);
// Forward declaration for SplitBundleLoader (C++ TurboModule header can't be imported in Swift bridging)
@interface SplitBundleLoader : NSObject
+ (void)loadEntryBundle:(NSString *)bundlePath inHost:(id)host;
+ (void)loadDevVendorEntryBundle:(NSURL *)bundleURL
                    hmrBundleURL:(NSURL *)hmrBundleURL
                     fingerprint:(NSString *)fingerprint
                          inHost:(id)host;
@end
