#import <Foundation/Foundation.h>
#import <MMKV/MMKV.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

static NSString *const OneKeyMigrationLedgerPrefix = @"onekey_native_storage_migration_";
static NSString *const OneKeyMigrationLedgerComplete = @"complete-v1";
static NSString *const OneKeyMigrationLedgerMigrating = @"migrating-v1";
static NSString *const OneKeyMigrationLedgerResetting = @"resetting-v1";
static NSString *const OneKeyRecoveryActionKey = @"onekey_recovery_action";
static NSString *const OneKeyTravelModeControlKey = @"onekey_travel_mode_control_v1";
static BOOL OneKeyTravelModePushSuppressionInitialized = NO;
static BOOL OneKeyTravelModePushSuppressed = NO;

static BOOL OneKeyReadTravelModeMaskingData(void)
{
  MMKV *mmkv = [MMKV mmkvWithID:@"onekey-app-setting"];
  if (mmkv == nil) {
    return YES;
  }
  NSString *rawValue = [mmkv getStringForKey:OneKeyTravelModeControlKey];
  if (rawValue.length == 0) {
    return NO;
  }
  NSData *data = [rawValue dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *record = data == nil
      ? nil
      : [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![record isKindOfClass:NSDictionary.class]) {
    return YES;
  }
  NSNumber *enabled = record[@"enabled"];
  NSString *verifyString = record[@"verifyString"];
  BOOL hasValidVerifyStringPrefix =
      [verifyString isKindOfClass:NSString.class] &&
      [verifyString hasPrefix:@"|VS|"] &&
      verifyString.length > @"|VS|".length;
  if (![enabled isKindOfClass:NSNumber.class] ||
      CFGetTypeID((__bridge CFTypeRef)enabled) != CFBooleanGetTypeID() ||
      ![verifyString isKindOfClass:NSString.class] ||
      !hasValidVerifyStringPrefix ||
      ![record[@"version"] isEqual:@1]) {
    return YES;
  }
  return enabled.boolValue;
}

BOOL OneKeyIsTravelModeMaskingData(void)
{
  if (!OneKeyTravelModePushSuppressionInitialized) {
    OneKeyTravelModePushSuppressed = OneKeyReadTravelModeMaskingData();
    OneKeyTravelModePushSuppressionInitialized = YES;
  }
  return OneKeyTravelModePushSuppressed;
}

static void OneKeySetTravelModePushSuppressed(BOOL suppressed)
{
  OneKeyTravelModePushSuppressed = suppressed;
  OneKeyTravelModePushSuppressionInitialized = YES;
}

@interface OneKeyNativeStorageMigration : NSObject <RCTBridgeModule>
@property(nonatomic, strong) dispatch_queue_t storageQueue;
@end

@implementation OneKeyNativeStorageMigration

RCT_EXPORT_MODULE(OneKeyNativeStorageMigration)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _storageQueue = dispatch_queue_create("so.onekey.native-storage-migration", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return self.storageQueue;
}

- (BOOL)isValidLedgerKey:(NSString *)key
{
  return [key isEqualToString:@"app-storage-v1"] ||
         [key isEqualToString:@"jotai-storage-v1"];
}

- (BOOL)isValidMMKVID:(NSString *)mmapID
{
  return [mmapID isEqualToString:@"onekey-app-storage-v1"] ||
         [mmapID isEqualToString:@"onekey-app-setting"] ||
         [mmapID isEqualToString:@"onekey-cold-start-cache"] ||
         [mmapID isEqualToString:@"onekey-app-dev-setting"] ||
         [mmapID isEqualToString:@"onekey-jotai-states"];
}

- (unsigned long long)directorySizeAtPath:(NSString *)path
{
  NSDirectoryEnumerator<NSURL *> *enumerator = [[NSFileManager defaultManager]
      enumeratorAtURL:[NSURL fileURLWithPath:path]
      includingPropertiesForKeys:@[NSURLIsRegularFileKey, NSURLFileSizeKey]
      options:NSDirectoryEnumerationSkipsHiddenFiles
      errorHandler:nil];
  unsigned long long total = 0;
  for (NSURL *fileURL in enumerator) {
    NSNumber *isRegularFile = nil;
    NSNumber *fileSize = nil;
    [fileURL getResourceValue:&isRegularFile forKey:NSURLIsRegularFileKey error:nil];
    if (isRegularFile.boolValue) {
      [fileURL getResourceValue:&fileSize forKey:NSURLFileSizeKey error:nil];
      total += fileSize.unsignedLongLongValue;
    }
  }
  return total;
}

RCT_REMAP_METHOD(readLegacyAsyncStorageValue,
                 readLegacyAsyncStorageValue:(NSString *)key
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  reject(@"LEGACY_ASYNC_STORAGE_READ_UNSUPPORTED",
         @"Chunked legacy AsyncStorage reads are only required on Android",
         nil);
}

RCT_REMAP_METHOD(getMigrationLedger,
                 getMigrationLedger:(NSString *)key
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![self isValidLedgerKey:key]) {
    reject(@"MIGRATION_LEDGER_READ_FAILED", @"Unsupported migration ledger key", nil);
    return;
  }
  NSString *ledgerKey = [OneKeyMigrationLedgerPrefix stringByAppendingString:key];
  resolve([[NSUserDefaults standardUserDefaults] stringForKey:ledgerKey]);
}

RCT_REMAP_METHOD(setMigrationLedger,
                 setMigrationLedger:(NSString *)key
                 value:(NSString *)value
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL isValidValue = [value isEqualToString:OneKeyMigrationLedgerComplete] ||
                      [value isEqualToString:OneKeyMigrationLedgerMigrating] ||
                      [value isEqualToString:OneKeyMigrationLedgerResetting];
  if (![self isValidLedgerKey:key] || !isValidValue) {
    reject(@"MIGRATION_LEDGER_WRITE_FAILED", @"Unsupported migration ledger entry", nil);
    return;
  }
  NSString *ledgerKey = [OneKeyMigrationLedgerPrefix stringByAppendingString:key];
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  [defaults setObject:value forKey:ledgerKey];
  [defaults synchronize];
  if (![[defaults stringForKey:ledgerKey] isEqualToString:value]) {
    reject(@"MIGRATION_LEDGER_WRITE_FAILED", @"Migration ledger verification failed", nil);
    return;
  }
  resolve(nil);
}

RCT_REMAP_METHOD(peekRecoveryAction,
                 peekRecoveryActionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([[NSUserDefaults standardUserDefaults] stringForKey:OneKeyRecoveryActionKey] ?: @"");
}

RCT_REMAP_METHOD(acknowledgeRecoveryAction,
                 acknowledgeRecoveryAction:(NSString *)expectedAction
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![expectedAction isEqualToString:@"auto_repair"] &&
      ![expectedAction isEqualToString:@"try_again"]) {
    reject(@"RECOVERY_ACTION_ACK_FAILED", @"Unsupported recovery action", nil);
    return;
  }
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  NSString *currentAction = [defaults stringForKey:OneKeyRecoveryActionKey] ?: @"";
  if (![currentAction isEqualToString:expectedAction]) {
    resolve(@NO);
    return;
  }
  [defaults removeObjectForKey:OneKeyRecoveryActionKey];
  [defaults synchronize];
  if ([defaults objectForKey:OneKeyRecoveryActionKey] != nil) {
    reject(@"RECOVERY_ACTION_ACK_FAILED", @"Recovery action acknowledgement failed", nil);
    return;
  }
  resolve(@YES);
}

RCT_REMAP_METHOD(syncMMKV,
                 syncMMKV:(NSString *)mmapID
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![self isValidMMKVID:mmapID]) {
    reject(@"MMKV_SYNC_FAILED", @"Unsupported MMKV instance", nil);
    return;
  }
  MMKV *mmkv = [MMKV mmkvWithID:mmapID];
  if (mmkv == nil) {
    reject(@"MMKV_SYNC_FAILED", @"MMKV instance is unavailable", nil);
    return;
  }
  [mmkv sync];
  resolve(nil);
}

RCT_REMAP_METHOD(setTravelModePushSuppressed,
                 setTravelModePushSuppressed:(BOOL)suppressed
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    OneKeySetTravelModePushSuppressed(suppressed);
    if (suppressed) {
      [UIApplication.sharedApplication unregisterForRemoteNotifications];
    } else {
      [UIApplication.sharedApplication registerForRemoteNotifications];
    }
    resolve(nil);
  });
}

RCT_REMAP_METHOD(getMigrationStorageCapacity,
                 getMigrationStorageCapacityWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  NSDictionary *fileSystemAttributes = [[NSFileManager defaultManager]
      attributesOfFileSystemForPath:NSHomeDirectory()
      error:&error];
  NSNumber *availableBytes = fileSystemAttributes[NSFileSystemFreeSize];
  if (availableBytes == nil || error != nil) {
    reject(@"MIGRATION_CAPACITY_READ_FAILED",
           error.localizedDescription ?: @"Storage capacity is unavailable",
           error);
    return;
  }

  NSString *applicationSupport = NSSearchPathForDirectoriesInDomains(
      NSApplicationSupportDirectory,
      NSUserDomainMask,
      YES).firstObject;
  NSString *bundleID = NSBundle.mainBundle.bundleIdentifier ?: @"";
  NSString *legacyPath = [[[applicationSupport stringByAppendingPathComponent:bundleID]
      stringByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"] copy];
  unsigned long long legacyBytes = [self directorySizeAtPath:legacyPath];
  resolve(@{
    @"availableBytes": availableBytes,
    @"legacyBytes": @(legacyBytes),
  });
}

@end
