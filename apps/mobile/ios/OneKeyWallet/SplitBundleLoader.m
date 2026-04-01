/**
 * SplitBundleLoader - Native module for production split bundle segment loading (Phase 2)
 *
 * Provides two methods to JS:
 * 1. getRuntimeBundleContext() - Returns current runtime's bundle paths and source kind
 * 2. loadSegment(params) - Registers a HBC segment with the current Hermes runtime
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>

// Forward declare RCTInstance registerSegment API
@interface RCTHost (SplitBundle)
- (void)registerSegmentWithId:(NSNumber *)segmentId path:(NSString *)path;
@end

@interface SplitBundleLoader : NSObject <RCTBridgeModule>
@end

@implementation SplitBundleLoader

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// MARK: - getRuntimeBundleContext

RCT_EXPORT_METHOD(getRuntimeBundleContext:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  @try {
    NSString *runtimeKind = @"main"; // iOS main app is always 'main' runtime
    NSString *sourceKind = @"builtin";
    NSString *bundleRoot = @"";
    NSString *nativeVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"";
    NSString *bundleVersion = @"";

    // Check if OTA bundle is active via BundleUpdateStore
    Class bundleUpdateStoreClass = NSClassFromString(@"ReactNativeBundleUpdate.BundleUpdateStore");
    if (bundleUpdateStoreClass) {
      NSString *otaBundlePath = [bundleUpdateStoreClass performSelector:NSSelectorFromString(@"currentBundleMainJSBundle")]
                                  ? [[bundleUpdateStoreClass performSelector:NSSelectorFromString(@"currentBundleMainJSBundle")] description]
                                  : nil;
      if (otaBundlePath && otaBundlePath.length > 0) {
        NSString *filePath = otaBundlePath;
        if ([otaBundlePath hasPrefix:@"file://"]) {
          filePath = [[NSURL URLWithString:otaBundlePath] path];
        }
        if ([[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
          sourceKind = @"ota";
          bundleRoot = [filePath stringByDeletingLastPathComponent];
        }
      }
    }

    // Builtin: use main bundle resource path
    if ([sourceKind isEqualToString:@"builtin"]) {
      bundleRoot = [[NSBundle mainBundle] resourcePath] ?: @"";
    }

    resolve(@{
      @"runtimeKind": runtimeKind,
      @"sourceKind": sourceKind,
      @"bundleRoot": bundleRoot,
      @"nativeVersion": nativeVersion,
      @"bundleVersion": bundleVersion,
    });
  } @catch (NSException *exception) {
    reject(@"SPLIT_BUNDLE_CONTEXT_ERROR", exception.reason, nil);
  }
}

// MARK: - loadSegment

RCT_EXPORT_METHOD(loadSegment:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSNumber *segmentId = params[@"segmentId"];
  NSString *segmentKey = params[@"segmentKey"];
  NSString *relativePath = params[@"relativePath"];

  if (!segmentId || !relativePath) {
    reject(@"SPLIT_BUNDLE_INVALID_PARAMS", @"segmentId and relativePath are required", nil);
    return;
  }

  @try {
    // Resolve absolute path
    // First check OTA bundle root
    NSString *absolutePath = nil;
    Class bundleUpdateStoreClass = NSClassFromString(@"ReactNativeBundleUpdate.BundleUpdateStore");
    if (bundleUpdateStoreClass) {
      NSString *otaBundlePath = nil;
      SEL sel = NSSelectorFromString(@"currentBundleMainJSBundle");
      if ([bundleUpdateStoreClass respondsToSelector:sel]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
        id result = [bundleUpdateStoreClass performSelector:sel];
#pragma clang diagnostic pop
        otaBundlePath = [result isKindOfClass:[NSString class]] ? (NSString *)result : nil;
      }
      if (otaBundlePath && otaBundlePath.length > 0) {
        NSString *filePath = otaBundlePath;
        if ([otaBundlePath hasPrefix:@"file://"]) {
          filePath = [[NSURL URLWithString:otaBundlePath] path];
        }
        NSString *otaRoot = [filePath stringByDeletingLastPathComponent];
        NSString *candidate = [otaRoot stringByAppendingPathComponent:relativePath];
        if ([[NSFileManager defaultManager] fileExistsAtPath:candidate]) {
          absolutePath = candidate;
        }
      }
    }

    // Fallback to builtin resource path
    if (!absolutePath) {
      NSString *builtinRoot = [[NSBundle mainBundle] resourcePath];
      NSString *candidate = [builtinRoot stringByAppendingPathComponent:relativePath];
      if ([[NSFileManager defaultManager] fileExistsAtPath:candidate]) {
        absolutePath = candidate;
      }
    }

    if (!absolutePath) {
      reject(@"SPLIT_BUNDLE_NOT_FOUND",
             [NSString stringWithFormat:@"Segment file not found: %@ (key=%@)", relativePath, segmentKey],
             nil);
      return;
    }

    // Register segment via RCTBridge
    RCTBridge *bridge = [RCTBridge currentBridge];
    if (bridge) {
      [bridge registerSegmentWithId:segmentId path:absolutePath];
      resolve(nil);
    } else {
      reject(@"SPLIT_BUNDLE_NO_BRIDGE", @"RCTBridge not available", nil);
    }
  } @catch (NSException *exception) {
    reject(@"SPLIT_BUNDLE_LOAD_ERROR",
           [NSString stringWithFormat:@"Failed to load segment %@: %@", segmentKey, exception.reason],
           nil);
  }
}

@end
