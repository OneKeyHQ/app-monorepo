//
//  EntryBundleLoader.mm
//  OneKeyWallet
//
//  ObjC++ helper for evaluating a secondary JS bundle inside an RCTHost runtime.
//  See EntryBundleLoader.h for design context.
//

#import "EntryBundleLoader.h"

#import <objc/runtime.h>
#include <jsi/jsi.h>

namespace jsi = facebook::jsi;

@implementation EntryBundleLoader

+ (void)loadEntryBundle:(NSString *)bundlePath inHost:(id)host
{
  if (!host || bundlePath.length == 0) {
    NSLog(@"[EntryBundleLoader] loadEntryBundle: invalid arguments (host=%@, path=%@)", host, bundlePath);
    return;
  }

  // Access the private RCTInstance stored as _instance inside RCTHost.
  Ivar ivar = class_getInstanceVariable([host class], "_instance");
  if (!ivar) {
    NSLog(@"[EntryBundleLoader] loadEntryBundle: _instance ivar not found on %@", [host class]);
    return;
  }

  id instance = object_getIvar(host, ivar);
  if (!instance) {
    NSLog(@"[EntryBundleLoader] loadEntryBundle: _instance is nil");
    return;
  }

  // Read the bundle data from disk.
  NSData *data = [NSData dataWithContentsOfFile:bundlePath];
  if (!data || data.length == 0) {
    NSLog(@"[EntryBundleLoader] loadEntryBundle: failed to read bundle at %@", bundlePath);
    return;
  }

  NSString *sourceURL = bundlePath.lastPathComponent ?: bundlePath;

  // Schedule evaluation on the buffered runtime executor so it runs on the JS thread
  // after the initial (common) bundle has been evaluated.
  [instance callFunctionOnBufferedRuntimeExecutor:^(jsi::Runtime &runtime) {
    @autoreleasepool {
      auto buffer = std::make_shared<jsi::StringBuffer>(
        std::string(static_cast<const char *>(data.bytes), data.length));
      runtime.evaluateJavaScript(std::move(buffer), [sourceURL UTF8String]);
    }
  }];
}

@end
