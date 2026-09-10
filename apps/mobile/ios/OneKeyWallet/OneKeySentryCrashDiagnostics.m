#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <Sentry/Sentry.h>
#import <Sentry/SentryDebugMeta.h>
#import <Sentry/SentryEvent.h>
#import <Sentry/SentryException.h>
#import <Sentry/SentryFrame.h>
#import <Sentry/SentryId.h>
#import <Sentry/SentryMechanism.h>
#import <Sentry/SentryStacktrace.h>
#import <Sentry/SentryThread.h>
@import Sentry.Swift;
#import <RNSentry/RNSentryStart.h>

static NSUInteger const OneKeyCrashDiagnosticsSchemaVersion = 1;
static NSUInteger const OneKeyCrashDiagnosticsMaxReportCount = 5;
static NSUInteger const OneKeyCrashDiagnosticsMaxFrameCount = 256;
static NSUInteger const OneKeyCrashDiagnosticsMaxStringLength = 1024;
static NSTimeInterval const OneKeyCrashDiagnosticsMaxReportAge = 7 * 24 * 60 * 60;

static NSString *OneKeySanitizeCrashString(id value)
{
  if (value == nil || value == NSNull.null) {
    return nil;
  }

  NSString *result = [[value description]
      stringByReplacingOccurrencesOfString:@"\n" withString:@" "];
  result = [result stringByReplacingOccurrencesOfString:@"\r" withString:@" "];

  static NSArray<NSRegularExpression *> *patterns;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSArray<NSString *> *rawPatterns = @[
      @"(?:0x)?[0-9a-fA-F]{64}",
      @"\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b",
      @"\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b",
      @"(?:\\b[a-z]{3,8}\\b[\\s,]+){11,}\\b[a-z]{3,8}\\b",
      @"(?i)(?:Bearer|token[=:]?)\\s*[A-Za-z0-9_.\\-+/=]{20,}",
      @"(?:eyJ|AAAA)[A-Za-z0-9+/=]{40,}",
    ];
    NSMutableArray<NSRegularExpression *> *compiledPatterns = [NSMutableArray array];
    for (NSString *pattern in rawPatterns) {
      NSRegularExpression *expression =
          [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil];
      if (expression != nil) {
        [compiledPatterns addObject:expression];
      }
    }
    patterns = [compiledPatterns copy];
  });

  for (NSRegularExpression *pattern in patterns) {
    result = [pattern stringByReplacingMatchesInString:result
                                               options:0
                                                 range:NSMakeRange(0, result.length)
                                          withTemplate:@"[REDACTED]"];
  }
  if (result.length > OneKeyCrashDiagnosticsMaxStringLength) {
    result = [[result substringToIndex:OneKeyCrashDiagnosticsMaxStringLength]
        stringByAppendingString:@"...(truncated)"];
  }
  return result;
}

static void OneKeyPutCrashString(
    NSMutableDictionary<NSString *, id> *dictionary,
    NSString *key,
    id value)
{
  NSString *sanitized = OneKeySanitizeCrashString(value);
  if (sanitized.length > 0) {
    dictionary[key] = sanitized;
  }
}

static NSString *OneKeyCrashDateString(NSDate *date)
{
  if (date == nil) {
    return nil;
  }
  static NSDateFormatter *formatter;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    formatter = [[NSDateFormatter alloc] init];
    formatter.locale = [[NSLocale alloc] initWithLocaleIdentifier:@"en_US_POSIX"];
    formatter.timeZone = [NSTimeZone timeZoneForSecondsFromGMT:0];
    formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX";
  });
  @synchronized(formatter) {
    return [formatter stringFromDate:date];
  }
}

static NSArray<NSDictionary<NSString *, id> *> *OneKeyCrashFrames(
    SentryStacktrace *stacktrace)
{
  if (stacktrace.frames.count == 0) {
    return @[];
  }
  NSUInteger start = stacktrace.frames.count > OneKeyCrashDiagnosticsMaxFrameCount
      ? stacktrace.frames.count - OneKeyCrashDiagnosticsMaxFrameCount
      : 0;
  NSMutableArray<NSDictionary<NSString *, id> *> *frames = [NSMutableArray array];
  for (NSUInteger index = start; index < stacktrace.frames.count; index += 1) {
    SentryFrame *frame = stacktrace.frames[index];
    NSMutableDictionary<NSString *, id> *item = [NSMutableDictionary dictionary];
    OneKeyPutCrashString(item, @"function", frame.function);
    OneKeyPutCrashString(item, @"module", frame.module);
    OneKeyPutCrashString(item, @"package", frame.package);
    OneKeyPutCrashString(item, @"fileName", frame.fileName);
    OneKeyPutCrashString(item, @"platform", frame.platform);
    OneKeyPutCrashString(item, @"imageAddress", frame.imageAddress);
    OneKeyPutCrashString(item, @"instructionAddress", frame.instructionAddress);
    OneKeyPutCrashString(item, @"symbolAddress", frame.symbolAddress);
    if (frame.lineNumber != nil) {
      item[@"lineNumber"] = frame.lineNumber;
    }
    if (frame.columnNumber != nil) {
      item[@"columnNumber"] = frame.columnNumber;
    }
    if (frame.inApp != nil) {
      item[@"inApp"] = frame.inApp;
    }
    [frames addObject:item];
  }
  return frames;
}

static NSArray<NSDictionary<NSString *, id> *> *OneKeyCrashExceptions(
    NSArray<SentryException *> *exceptions)
{
  NSMutableArray<NSDictionary<NSString *, id> *> *result = [NSMutableArray array];
  for (SentryException *exception in exceptions ?: @[]) {
    NSMutableDictionary<NSString *, id> *item = [NSMutableDictionary dictionary];
    OneKeyPutCrashString(item, @"type", exception.type);
    OneKeyPutCrashString(item, @"value", exception.value);
    OneKeyPutCrashString(item, @"module", exception.module);
    if (exception.threadId != nil) {
      item[@"threadId"] = exception.threadId;
    }
    if (exception.mechanism != nil) {
      NSMutableDictionary<NSString *, id> *mechanism = [NSMutableDictionary dictionary];
      OneKeyPutCrashString(mechanism, @"type", exception.mechanism.type);
      OneKeyPutCrashString(mechanism, @"description", exception.mechanism.desc);
      if (exception.mechanism.handled != nil) {
        mechanism[@"handled"] = exception.mechanism.handled;
      }
      item[@"mechanism"] = mechanism;
    }
    NSArray<NSDictionary<NSString *, id> *> *frames =
        OneKeyCrashFrames(exception.stacktrace);
    if (frames.count > 0) {
      item[@"frames"] = frames;
    }
    [result addObject:item];
  }
  return result;
}

static NSArray<NSDictionary<NSString *, id> *> *OneKeyCrashThreads(
    NSArray<SentryThread *> *threads)
{
  NSMutableArray<NSDictionary<NSString *, id> *> *result = [NSMutableArray array];
  for (SentryThread *thread in threads ?: @[]) {
    if (!thread.crashed.boolValue && !thread.current.boolValue && !thread.isMain.boolValue) {
      continue;
    }
    NSMutableDictionary<NSString *, id> *item = [NSMutableDictionary dictionary];
    if (thread.threadId != nil) {
      item[@"id"] = thread.threadId;
    }
    OneKeyPutCrashString(item, @"name", thread.name);
    if (thread.crashed != nil) {
      item[@"crashed"] = thread.crashed;
    }
    if (thread.current != nil) {
      item[@"current"] = thread.current;
    }
    if (thread.isMain != nil) {
      item[@"main"] = thread.isMain;
    }
    NSArray<NSDictionary<NSString *, id> *> *frames = OneKeyCrashFrames(thread.stacktrace);
    if (frames.count > 0) {
      item[@"frames"] = frames;
    }
    [result addObject:item];
  }
  return result;
}

static NSArray<NSDictionary<NSString *, id> *> *OneKeyCrashDebugImages(
    NSArray<SentryDebugMeta *> *debugMeta)
{
  NSMutableArray<NSDictionary<NSString *, id> *> *result = [NSMutableArray array];
  for (SentryDebugMeta *image in debugMeta ?: @[]) {
    NSMutableDictionary<NSString *, id> *item = [NSMutableDictionary dictionary];
    OneKeyPutCrashString(item, @"type", image.type);
    OneKeyPutCrashString(item, @"debugId", image.debugID);
    OneKeyPutCrashString(item, @"codeFile", image.codeFile);
    OneKeyPutCrashString(item, @"imageAddress", image.imageAddress);
    OneKeyPutCrashString(item, @"imageVmAddress", image.imageVmAddress);
    if (image.imageSize != nil) {
      item[@"imageSize"] = image.imageSize;
    }
    [result addObject:item];
  }
  return result;
}

static NSString *OneKeyCrashDiagnosticsDirectory(void)
{
  NSString *cachesDirectory = NSSearchPathForDirectoriesInDomains(
      NSCachesDirectory,
      NSUserDomainMask,
      YES).firstObject;
  return [cachesDirectory stringByAppendingPathComponent:@"logs/crashes"];
}

static void OneKeyCleanupCrashReports(NSString *directoryPath, NSDate *now)
{
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSArray<NSString *> *names = [fileManager contentsOfDirectoryAtPath:directoryPath error:nil];
  NSMutableArray<NSDictionary<NSString *, id> *> *retained = [NSMutableArray array];
  for (NSString *name in names ?: @[]) {
    if (![name hasSuffix:@".json"]) {
      continue;
    }
    NSString *path = [directoryPath stringByAppendingPathComponent:name];
    NSDictionary<NSFileAttributeKey, id> *attributes =
        [fileManager attributesOfItemAtPath:path error:nil];
    NSDate *modifiedAt = attributes[NSFileModificationDate] ?: NSDate.distantPast;
    if ([now timeIntervalSinceDate:modifiedAt] > OneKeyCrashDiagnosticsMaxReportAge) {
      [fileManager removeItemAtPath:path error:nil];
    } else {
      [retained addObject:@{ @"path": path, @"modifiedAt": modifiedAt }];
    }
  }

  [retained sortUsingComparator:^NSComparisonResult(
      NSDictionary<NSString *, id> *left,
      NSDictionary<NSString *, id> *right) {
    return [right[@"modifiedAt"] compare:left[@"modifiedAt"]];
  }];
  for (NSUInteger index = OneKeyCrashDiagnosticsMaxReportCount;
       index < retained.count;
       index += 1) {
    [fileManager removeItemAtPath:retained[index][@"path"] error:nil];
  }
}

static void OneKeyPersistCrashEvent(SentryEvent *event)
{
  @try {
    NSMutableDictionary<NSString *, id> *report = [@{
      @"schemaVersion": @(OneKeyCrashDiagnosticsSchemaVersion),
      @"source": @"sentry",
      @"platform": @"ios",
      @"capturedAt": OneKeyCrashDateString(NSDate.date),
    } mutableCopy];
    OneKeyPutCrashString(report, @"eventId", event.eventId.sentryIdString);
    OneKeyPutCrashString(
        report,
        @"level",
        event.level == kSentryLevelFatal ? @"fatal" : @"error");
    OneKeyPutCrashString(report, @"release", event.releaseName);
    OneKeyPutCrashString(report, @"dist", event.dist);
    OneKeyPutCrashString(report, @"environment", event.environment);
    NSString *timestamp = OneKeyCrashDateString(event.timestamp);
    if (timestamp.length > 0) {
      report[@"timestamp"] = timestamp;
    }

    NSArray<NSDictionary<NSString *, id> *> *exceptions =
        OneKeyCrashExceptions(event.exceptions);
    if (exceptions.count > 0) {
      report[@"exceptions"] = exceptions;
    }
    NSArray<NSDictionary<NSString *, id> *> *threads = OneKeyCrashThreads(event.threads);
    if (threads.count > 0) {
      report[@"threads"] = threads;
    }
    NSArray<NSDictionary<NSString *, id> *> *debugImages =
        OneKeyCrashDebugImages(event.debugMeta);
    if (debugImages.count > 0) {
      report[@"debugImages"] = debugImages;
    }

    NSError *serializationError = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:report
                                                   options:NSJSONWritingPrettyPrinted
                                                     error:&serializationError];
    if (data == nil || serializationError != nil) {
      return;
    }

    NSString *directoryPath = OneKeyCrashDiagnosticsDirectory();
    NSFileManager *fileManager = NSFileManager.defaultManager;
    [fileManager createDirectoryAtPath:directoryPath
           withIntermediateDirectories:YES
                            attributes:@{
                              NSFileProtectionKey:
                                  NSFileProtectionCompleteUntilFirstUserAuthentication,
                            }
                                 error:nil];
    NSString *eventId = event.eventId.sentryIdString;
    if (eventId.length == 0) {
      eventId = [NSString stringWithFormat:@"%.0f", NSDate.date.timeIntervalSince1970 * 1000];
    }
    NSString *path = [directoryPath stringByAppendingPathComponent:
        [NSString stringWithFormat:@"sentry-native-%@.json", eventId]];
    if (![data writeToFile:path options:NSDataWritingAtomic error:nil]) {
      return;
    }
    [fileManager setAttributes:@{
      NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication,
    } ofItemAtPath:path error:nil];
    OneKeyCleanupCrashReports(directoryPath, NSDate.date);
  } @catch (NSException *exception) {
    NSLog(@"[OneKeySentryCrashDiagnostics] Failed to persist native crash diagnostics: %@",
          exception.reason);
  }
}

@interface OneKeySentryCrashDiagnostics : NSObject <RCTBridgeModule>
@end

@implementation OneKeySentryCrashDiagnostics

RCT_EXPORT_MODULE(OneKeySentryCrashDiagnostics)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(initialize:(NSDictionary *)configuration)
{
  static BOOL initialized = NO;
  @synchronized([OneKeySentryCrashDiagnostics class]) {
    if (initialized) {
      return @YES;
    }

    NSString *dsn = [configuration[@"dsn"] isKindOfClass:NSString.class]
        ? configuration[@"dsn"]
        : @"";
    if (dsn.length == 0) {
      return @NO;
    }

    OneKeyCleanupCrashReports(OneKeyCrashDiagnosticsDirectory(), NSDate.date);
    __block BOOL didStart = NO;
    void (^startSentry)(void) = ^{
      NSError *optionsError = nil;
      SentryOptions *options =
          [RNSentryStart createOptionsWithDictionary:@{ @"dsn" : dsn }
                                               error:&optionsError];
      if (options == nil || optionsError != nil) {
        NSLog(@"[OneKeySentryCrashDiagnostics] Failed to create Sentry options");
        return;
      }
      [RNSentryStart updateWithReactDefaults:options];
      options.enabled = [configuration[@"enabled"] boolValue];
      options.maxBreadcrumbs = [configuration[@"maxBreadcrumbs"] unsignedIntValue];
      options.maxCacheItems = [configuration[@"maxCacheItems"] unsignedIntValue];
      options.enableAppHangTracking =
          [configuration[@"enableAppHangTracking"] boolValue];
      options.appHangTimeoutInterval =
          [configuration[@"appHangTimeoutInterval"] doubleValue];
      options.enableCrashHandler =
          [configuration[@"enableNativeCrashHandling"] boolValue];
      options.enableWatchdogTerminationTracking =
          [configuration[@"enableWatchdogTerminationTracking"] boolValue];
      options.attachScreenshot = [configuration[@"attachScreenshot"] boolValue];
      options.attachViewHierarchy =
          [configuration[@"attachViewHierarchy"] boolValue];
      options.sendDefaultPii = [configuration[@"sendDefaultPii"] boolValue];
      options.onCrashedLastRun = ^(SentryEvent *event) {
        OneKeyPersistCrashEvent(event);
      };
      [RNSentryStart updateWithReactFinals:options];
      [RNSentryStart startWithOptions:options];
      didStart = YES;
    };

    if (NSThread.isMainThread) {
      startSentry();
    } else {
      dispatch_sync(dispatch_get_main_queue(), startSentry);
    }
    initialized = didStart;
    return @(didStart);
  }
}

@end
