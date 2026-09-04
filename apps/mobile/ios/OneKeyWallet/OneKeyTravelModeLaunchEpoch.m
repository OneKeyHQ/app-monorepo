#import <Foundation/Foundation.h>
#import <MMKV/MMKV.h>
#import <React/RCTBridgeModule.h>

static NSString *const OneKeyTravelModeMMKVID = @"onekey-app-setting";
static NSString *const OneKeyTravelModeControlKey = @"onekey_travel_mode_control_v1";
static NSString *const OneKeyTravelModeEpochKey = @"onekey_travel_mode_launch_epoch";
static NSString *const OneKeyTravelModePendingEpochKey = @"onekey_travel_mode_pending_epoch";
static NSString *const OneKeyTravelModePendingProfileKey = @"onekey_travel_mode_pending_profile";
static NSString *const OneKeyTravelModePendingDeadlineKey = @"onekey_travel_mode_pending_deadline";
static NSString *const OneKeyTravelModeMainAckEpochKey = @"onekey_travel_mode_main_ack_epoch";
static NSString *const OneKeyTravelModeBackgroundAckEpochKey = @"onekey_travel_mode_background_ack_epoch";
static NSString *const OneKeyTravelModeCompletedEpochKey = @"onekey_travel_mode_completed_epoch";
static NSTimeInterval const OneKeyTravelModeAcknowledgementTimeoutMs = 10000.0;

static NSDictionary *OneKeyTravelModeLaunchStatus(
    NSString *status,
    unsigned long long epoch,
    NSTimeInterval deadlineAt)
{
  NSMutableDictionary *result = [@{
    @"status": status,
    @"epoch": @(epoch),
  } mutableCopy];
  if (deadlineAt > 0) {
    result[@"deadlineAt"] = @(deadlineAt);
  }
  return result;
}

static BOOL OneKeyTravelModeProfileIsValid(NSString *profile)
{
  return [profile isEqualToString:@"standard"] ||
         [profile isEqualToString:@"travel-mode"];
}

static BOOL OneKeyTravelModeRuntimeIsValid(NSString *runtime)
{
  return [runtime isEqualToString:@"main"] ||
         [runtime isEqualToString:@"background"];
}

static BOOL OneKeyTravelModeControlRecordIsValid(NSDictionary *record)
{
  NSNumber *enabled = record[@"enabled"];
  NSString *verifyString = record[@"verifyString"];
  return [enabled isKindOfClass:NSNumber.class] &&
         CFGetTypeID((__bridge CFTypeRef)enabled) == CFBooleanGetTypeID() &&
         [verifyString isKindOfClass:NSString.class] &&
         [verifyString hasPrefix:@"|VS|"] &&
         verifyString.length > @"|VS|".length &&
         [record[@"version"] isEqual:@1];
}

static BOOL OneKeyForceDisableTravelModeControl(void)
{
  [MMKV initializeMMKV:nil];
  MMKV *mmkv = [MMKV mmkvWithID:OneKeyTravelModeMMKVID];
  if (mmkv == nil) {
    return NO;
  }

  NSString *rawValue = [mmkv getStringForKey:OneKeyTravelModeControlKey];
  if (rawValue.length > 0) {
    NSData *data = [rawValue dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *record = data == nil
        ? nil
        : [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if ([record isKindOfClass:NSDictionary.class] &&
        OneKeyTravelModeControlRecordIsValid(record)) {
      NSMutableDictionary *disabledRecord = [record mutableCopy];
      disabledRecord[@"enabled"] = @NO;
      NSError *serializationError = nil;
      NSData *disabledData = [NSJSONSerialization dataWithJSONObject:disabledRecord
                                                              options:0
                                                                error:&serializationError];
      NSString *disabledValue = disabledData == nil
          ? nil
          : [[NSString alloc] initWithData:disabledData encoding:NSUTF8StringEncoding];
      if (serializationError != nil || disabledValue.length == 0 ||
          ![mmkv setString:disabledValue forKey:OneKeyTravelModeControlKey]) {
        return NO;
      }
    } else {
      [mmkv removeValueForKey:OneKeyTravelModeControlKey];
    }
  }
  [mmkv sync];

  NSString *persistedValue = [mmkv getStringForKey:OneKeyTravelModeControlKey];
  if (persistedValue.length == 0) {
    return YES;
  }
  NSData *persistedData = [persistedValue dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *persistedRecord = persistedData == nil
      ? nil
      : [NSJSONSerialization JSONObjectWithData:persistedData options:0 error:nil];
  return [persistedRecord isKindOfClass:NSDictionary.class] &&
         OneKeyTravelModeControlRecordIsValid(persistedRecord) &&
         ![persistedRecord[@"enabled"] boolValue];
}

@interface OneKeyTravelModeLaunchEpoch : NSObject <RCTBridgeModule>
@property(nonatomic, strong) dispatch_queue_t launchEpochQueue;
@end

BOOL OneKeyForceDisableTravelModeForRecovery(void)
{
  @try {
    @synchronized (OneKeyTravelModeLaunchEpoch.class) {
      if (!OneKeyForceDisableTravelModeControl()) {
        return NO;
      }
      NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
      [defaults removeObjectForKey:OneKeyTravelModePendingEpochKey];
      [defaults removeObjectForKey:OneKeyTravelModePendingProfileKey];
      [defaults removeObjectForKey:OneKeyTravelModePendingDeadlineKey];
      [defaults removeObjectForKey:OneKeyTravelModeMainAckEpochKey];
      [defaults removeObjectForKey:OneKeyTravelModeBackgroundAckEpochKey];
      if (![defaults synchronize]) {
        return NO;
      }
      return [defaults objectForKey:OneKeyTravelModePendingEpochKey] == nil;
    }
  } @catch (NSException *exception) {
    (void)exception;
    return NO;
  }
}

@implementation OneKeyTravelModeLaunchEpoch

RCT_EXPORT_MODULE(OneKeyTravelModeLaunchEpoch)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _launchEpochQueue = dispatch_queue_create(
        "so.onekey.travel-mode-launch-epoch",
        DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return self.launchEpochQueue;
}

- (NSDictionary *)readStatusForEpoch:(unsigned long long)requestedEpoch
{
  NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
  unsigned long long completedEpoch =
      [[defaults objectForKey:OneKeyTravelModeCompletedEpochKey] unsignedLongLongValue];
  if (completedEpoch == requestedEpoch) {
    return OneKeyTravelModeLaunchStatus(@"complete", requestedEpoch, 0);
  }
  unsigned long long pendingEpoch =
      [[defaults objectForKey:OneKeyTravelModePendingEpochKey] unsignedLongLongValue];
  if (pendingEpoch != requestedEpoch) {
    return OneKeyTravelModeLaunchStatus(@"superseded", requestedEpoch, 0);
  }
  NSTimeInterval deadlineAt =
      [[defaults objectForKey:OneKeyTravelModePendingDeadlineKey] doubleValue];
  if ([[NSDate date] timeIntervalSince1970] * 1000.0 >= deadlineAt) {
    return OneKeyTravelModeLaunchStatus(@"timed-out", requestedEpoch, deadlineAt);
  }
  BOOL mainAcknowledged =
      [[defaults objectForKey:OneKeyTravelModeMainAckEpochKey] unsignedLongLongValue] == requestedEpoch;
  BOOL backgroundAcknowledged =
      [[defaults objectForKey:OneKeyTravelModeBackgroundAckEpochKey] unsignedLongLongValue] == requestedEpoch;
  if (!mainAcknowledged || !backgroundAcknowledged) {
    return OneKeyTravelModeLaunchStatus(@"pending", requestedEpoch, deadlineAt);
  }

  [defaults setObject:@(requestedEpoch) forKey:OneKeyTravelModeCompletedEpochKey];
  [defaults removeObjectForKey:OneKeyTravelModePendingEpochKey];
  [defaults removeObjectForKey:OneKeyTravelModePendingProfileKey];
  [defaults removeObjectForKey:OneKeyTravelModePendingDeadlineKey];
  [defaults removeObjectForKey:OneKeyTravelModeMainAckEpochKey];
  [defaults removeObjectForKey:OneKeyTravelModeBackgroundAckEpochKey];
  [defaults synchronize];
  return OneKeyTravelModeLaunchStatus(@"complete", requestedEpoch, 0);
}

RCT_REMAP_METHOD(prepareRestart,
                 prepareRestartForProfile:(NSString *)profile
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @synchronized (OneKeyTravelModeLaunchEpoch.class) {
    if (!OneKeyTravelModeProfileIsValid(profile)) {
      reject(@"TRAVEL_MODE_LAUNCH_PREPARE_FAILED", @"Unsupported profile", nil);
      return;
    }
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
    unsigned long long epoch =
        [[defaults objectForKey:OneKeyTravelModeEpochKey] unsignedLongLongValue] + 1;
    NSTimeInterval deadlineAt =
        [[NSDate date] timeIntervalSince1970] * 1000.0 +
        OneKeyTravelModeAcknowledgementTimeoutMs;
    [defaults setObject:@(epoch) forKey:OneKeyTravelModeEpochKey];
    [defaults setObject:@(epoch) forKey:OneKeyTravelModePendingEpochKey];
    [defaults setObject:profile forKey:OneKeyTravelModePendingProfileKey];
    [defaults setObject:@(deadlineAt) forKey:OneKeyTravelModePendingDeadlineKey];
    [defaults removeObjectForKey:OneKeyTravelModeMainAckEpochKey];
    [defaults removeObjectForKey:OneKeyTravelModeBackgroundAckEpochKey];
    [defaults synchronize];
    if ([[defaults objectForKey:OneKeyTravelModePendingEpochKey] unsignedLongLongValue] != epoch) {
      reject(@"TRAVEL_MODE_LAUNCH_PREPARE_FAILED", @"Launch epoch commit failed", nil);
      return;
    }
    resolve(@(epoch));
  }
}

RCT_REMAP_METHOD(forceDisableForRecovery,
                 forceDisableForRecoveryWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (!OneKeyForceDisableTravelModeForRecovery()) {
    reject(@"TRAVEL_MODE_RECOVERY_FAILED", @"Travel Mode recovery commit failed", nil);
    return;
  }
  resolve(nil);
}

RCT_REMAP_METHOD(acknowledgeRuntimeLaunch,
                 acknowledgeRuntimeLaunch:(NSString *)runtime
                 profile:(NSString *)profile
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @synchronized (OneKeyTravelModeLaunchEpoch.class) {
    if (!OneKeyTravelModeRuntimeIsValid(runtime) ||
        !OneKeyTravelModeProfileIsValid(profile)) {
      reject(@"TRAVEL_MODE_LAUNCH_ACK_FAILED", @"Unsupported acknowledgement", nil);
      return;
    }
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
    unsigned long long pendingEpoch =
        [[defaults objectForKey:OneKeyTravelModePendingEpochKey] unsignedLongLongValue];
    if (pendingEpoch == 0) {
      unsigned long long completedEpoch =
          [[defaults objectForKey:OneKeyTravelModeCompletedEpochKey] unsignedLongLongValue];
      resolve(OneKeyTravelModeLaunchStatus(@"idle", completedEpoch, 0));
      return;
    }
    NSTimeInterval deadlineAt =
        [[defaults objectForKey:OneKeyTravelModePendingDeadlineKey] doubleValue];
    if ([[NSDate date] timeIntervalSince1970] * 1000.0 >= deadlineAt) {
      resolve(OneKeyTravelModeLaunchStatus(@"timed-out", pendingEpoch, deadlineAt));
      return;
    }
    NSString *expectedProfile =
        [defaults stringForKey:OneKeyTravelModePendingProfileKey] ?: @"";
    if (![profile isEqualToString:expectedProfile]) {
      resolve(OneKeyTravelModeLaunchStatus(@"mismatch", pendingEpoch, deadlineAt));
      return;
    }
    NSString *acknowledgementKey = [runtime isEqualToString:@"main"]
        ? OneKeyTravelModeMainAckEpochKey
        : OneKeyTravelModeBackgroundAckEpochKey;
    [defaults setObject:@(pendingEpoch) forKey:acknowledgementKey];
    [defaults synchronize];
    if ([[defaults objectForKey:acknowledgementKey] unsignedLongLongValue] != pendingEpoch) {
      reject(@"TRAVEL_MODE_LAUNCH_ACK_FAILED", @"Runtime acknowledgement commit failed", nil);
      return;
    }
    resolve([self readStatusForEpoch:pendingEpoch]);
  }
}

RCT_REMAP_METHOD(getLaunchStatus,
                 getLaunchStatusForEpoch:(nonnull NSNumber *)requestedEpochValue
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @synchronized (OneKeyTravelModeLaunchEpoch.class) {
    double rawEpoch = requestedEpochValue.doubleValue;
    unsigned long long requestedEpoch = requestedEpochValue.unsignedLongLongValue;
    if (requestedEpoch == 0 || rawEpoch != (double)requestedEpoch) {
      reject(@"TRAVEL_MODE_LAUNCH_STATUS_FAILED", @"Invalid launch epoch", nil);
      return;
    }
    resolve([self readStatusForEpoch:requestedEpoch]);
  }
}

@end
