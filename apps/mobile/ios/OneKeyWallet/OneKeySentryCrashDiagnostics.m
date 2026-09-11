#import <Foundation/Foundation.h>
#import <MetricKit/MetricKit.h>
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
static NSUInteger const OneKeyCrashDiagnosticsMaxTransportExceptionCount = 8;
static NSUInteger const OneKeyCrashDiagnosticsMaxTransportThreadCount = 16;
static NSUInteger const OneKeyCrashDiagnosticsMaxTransportDebugImageCount = 256;
static NSUInteger const OneKeyCrashDiagnosticsMaxTransportFrameCount = 128;
static NSTimeInterval const OneKeyCrashDiagnosticsMaxReportAge = 7 * 24 * 60 * 60;

static dispatch_queue_t OneKeyCrashDiagnosticsQueue(void)
{
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = dispatch_queue_create(
        "so.onekey.wallet.crash-diagnostics",
        dispatch_queue_attr_make_with_qos_class(
            DISPATCH_QUEUE_SERIAL,
            QOS_CLASS_UTILITY,
            0));
  });
  return queue;
}

static NSSet<NSString *> *OneKeyMnemonicWords(void)
{
  static NSSet<NSString *> *words;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *path = [NSBundle.mainBundle pathForResource:@"OneKeyBip39English"
                                                   ofType:@"json"];
    NSData *data = path.length > 0 ? [NSData dataWithContentsOfFile:path] : nil;
    NSArray *source = data.length > 0
        ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil]
        : nil;
    NSMutableSet<NSString *> *loadedWords = [NSMutableSet set];
    if ([source isKindOfClass:NSArray.class]) {
      for (id item in source) {
        if ([item isKindOfClass:NSString.class]) {
          [loadedWords addObject:[item lowercaseString]];
        }
      }
    }
    words = [loadedWords copy];
  });
  return words;
}

static NSString *OneKeyRedactMnemonicSequences(NSString *value)
{
  if (value.length == 0 || OneKeyMnemonicWords().count == 0) {
    return value;
  }
  static NSRegularExpression *wordPattern;
  static NSCharacterSet *invalidSeparatorCharacters;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    wordPattern = [NSRegularExpression regularExpressionWithPattern:@"[A-Za-z]+"
                                                            options:0
                                                              error:nil];
    NSCharacterSet *allowedSeparators =
        [NSCharacterSet characterSetWithCharactersInString:@" \t\r\n,"];
    invalidSeparatorCharacters = allowedSeparators.invertedSet;
  });

  NSMutableArray<NSValue *> *sequence = [NSMutableArray array];
  NSMutableArray<NSValue *> *sensitiveRanges = [NSMutableArray array];
  __block NSRange previousRange = NSMakeRange(NSNotFound, 0);
  void (^retainSequence)(void) = ^{
    if (sequence.count >= 3) {
      [sensitiveRanges addObjectsFromArray:sequence];
    }
    [sequence removeAllObjects];
  };
  NSArray<NSTextCheckingResult *> *matches =
      [wordPattern matchesInString:value options:0 range:NSMakeRange(0, value.length)];
  for (NSTextCheckingResult *match in matches) {
    NSRange range = match.range;
    BOOL followsSequence = previousRange.location == NSNotFound;
    if (!followsSequence) {
      NSUInteger separatorStart = NSMaxRange(previousRange);
      NSRange separatorRange = NSMakeRange(separatorStart, range.location - separatorStart);
      NSString *separator = [value substringWithRange:separatorRange];
      followsSequence =
          [separator rangeOfCharacterFromSet:invalidSeparatorCharacters].location == NSNotFound;
    }
    NSString *word = [[value substringWithRange:range] lowercaseString];
    BOOL isMnemonicWord = [OneKeyMnemonicWords() containsObject:word];
    if (!followsSequence || !isMnemonicWord) {
      retainSequence();
    }
    if (isMnemonicWord) {
      [sequence addObject:[NSValue valueWithRange:range]];
    }
    previousRange = range;
  }
  retainSequence();
  if (sensitiveRanges.count == 0) {
    return value;
  }
  NSMutableString *result = [value mutableCopy];
  for (NSValue *rangeValue in sensitiveRanges.reverseObjectEnumerator) {
    [result replaceCharactersInRange:rangeValue.rangeValue withString:@"[REDACTED]"];
  }
  return result;
}

static BOOL OneKeyIsSensitiveKey(NSString *key)
{
  NSString *normalized = [[[key lowercaseString]
      componentsSeparatedByCharactersInSet:NSCharacterSet.alphanumericCharacterSet.invertedSet]
      componentsJoinedByString:@""];
  NSArray<NSString *> *markers = @[
    @"password", @"passwd", @"passphrase", @"secret", @"token",
    @"authorization", @"cookie", @"sessionid", @"apikey", @"privatekey",
    @"mnemonic", @"seed", @"recoveryphrase", @"credential", @"bearer",
  ];
  for (NSString *marker in markers) {
    if ([normalized containsString:marker]) {
      return YES;
    }
  }
  return NO;
}

static NSString *OneKeySanitizeCrashString(id value)
{
  if (value == nil || value == NSNull.null) {
    return nil;
  }

  NSString *result = [[value description]
      stringByReplacingOccurrencesOfString:@"\n" withString:@" "];
  result = [result stringByReplacingOccurrencesOfString:@"\r" withString:@" "];
  result = OneKeyRedactMnemonicSequences(result);

  static NSArray<NSRegularExpression *> *sensitiveValuePatterns;
  static NSArray<NSString *> *sensitiveValueReplacements;
  static NSRegularExpression *bearerPattern;
  static dispatch_once_t sensitiveValueOnceToken;
  dispatch_once(&sensitiveValueOnceToken, ^{
    NSArray<NSString *> *rawPatterns = @[
      @"(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)[\\[{][\\s\\S]*",
      @"(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)\"[^\"]*\"",
      @"(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)'[^']*'",
      @"(?i)([\"']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)[\"']?\\s*[:=]\\s*)[^\"'\\s,;}]+",
    ];
    NSMutableArray<NSRegularExpression *> *compiled = [NSMutableArray array];
    for (NSString *pattern in rawPatterns) {
      NSRegularExpression *expression =
          [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil];
      if (expression != nil) {
        [compiled addObject:expression];
      }
    }
    sensitiveValuePatterns = [compiled copy];
    sensitiveValueReplacements = @[
      @"$1[REDACTED]",
      @"$1\"[REDACTED]\"",
      @"$1'[REDACTED]'",
      @"$1[REDACTED]",
    ];
    bearerPattern = [NSRegularExpression
        regularExpressionWithPattern:@"(?i)(\\bbearer\\s+)[A-Za-z0-9._~+/-]+=*"
                              options:0
                                error:nil];
  });
  result = [bearerPattern stringByReplacingMatchesInString:result
                                                   options:0
                                                     range:NSMakeRange(0, result.length)
                                              withTemplate:@"$1[REDACTED]"];
  for (NSUInteger index = 0; index < sensitiveValuePatterns.count; index += 1) {
    NSRegularExpression *pattern = sensitiveValuePatterns[index];
    result = [pattern stringByReplacingMatchesInString:result
                                               options:0
                                                 range:NSMakeRange(0, result.length)
                                          withTemplate:sensitiveValueReplacements[index]];
  }

  static NSArray<NSRegularExpression *> *patterns;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSArray<NSString *> *rawPatterns = @[
      @"(?i)\\b(?:https?|wss?)://[^\\s]+",
      @"(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
      @"\\b0x[0-9a-fA-F]{40,64}\\b",
      @"\\b[0-9a-fA-F]{64}\\b",
      @"\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b",
      @"\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b",
      @"(?i)\\b(?:[a-z0-9]{1,20}1)[a-z0-9]{20,90}\\b",
      @"\\b[1-9A-HJ-NP-Za-km-z]{32,128}\\b",
      @"\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b",
      @"(?i)\\b(?:mnemonic|seed(?:\\s+phrase)?)\\s*[=:]\\s*(?:\\p{L}{2,16}[\\s,]+){2,}\\p{L}{2,16}\\b",
      @"(?i)(?:\\b\\p{L}{2,16}\\b[\\s,]+){11,}\\b\\p{L}{2,16}\\b",
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
  return result;
}

static NSString *OneKeyFileNameOnly(NSString *value)
{
  return value.length > 0 ? value.lastPathComponent : value;
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

static void OneKeySanitizeStacktraceForTransport(SentryStacktrace *stacktrace)
{
  if (stacktrace == nil) {
    return;
  }
  NSArray<SentryFrame *> *allFrames = stacktrace.frames ?: @[];
  NSUInteger start = allFrames.count > OneKeyCrashDiagnosticsMaxTransportFrameCount
      ? allFrames.count - OneKeyCrashDiagnosticsMaxTransportFrameCount
      : 0;
  NSMutableArray<SentryFrame *> *frames = [NSMutableArray array];
  for (NSUInteger index = start; index < allFrames.count; index += 1) {
    SentryFrame *frame = allFrames[index];
    frame.fileName = OneKeyFileNameOnly(frame.fileName);
    frame.contextLine = nil;
    frame.preContext = nil;
    frame.postContext = nil;
    frame.vars = nil;
    [frames addObject:frame];
  }
  stacktrace.frames = frames;
  stacktrace.registers = @{};
}

static NSDictionary<NSString *, NSDictionary<NSString *, id> *> *
OneKeySafeSentryContexts(NSDictionary<NSString *, NSDictionary<NSString *, id> *> *contexts)
{
  if (contexts.count == 0) {
    return nil;
  }
  NSDictionary<NSString *, NSSet<NSString *> *> *safeFields = @{
    @"app": [NSSet setWithArray:@[
      @"app_identifier", @"app_name", @"app_version", @"app_build",
      @"build_type", @"in_foreground", @"app_start_time", @"start_type",
    ]],
    @"device": [NSSet setWithArray:@[
      @"manufacturer", @"brand", @"family", @"model", @"model_id", @"archs",
      @"simulator", @"memory_size", @"free_memory", @"usable_memory",
      @"low_memory", @"storage_size", @"free_storage", @"orientation",
      @"screen_width_pixels", @"screen_height_pixels", @"screen_density",
      @"screen_dpi", @"processor_count", @"processor_frequency", @"chipset",
    ]],
    @"os": [NSSet setWithArray:@[
      @"name", @"version", @"build", @"kernel_version", @"rooted",
    ]],
    @"runtime": [NSSet setWithArray:@[ @"name", @"version" ]],
    @"gpu": [NSSet setWithArray:@[
      @"name", @"id", @"vendor_id", @"vendor_name", @"memory_size",
      @"api_type", @"multi_threaded_rendering", @"version", @"npot_support",
    ]],
  };
  NSMutableDictionary<NSString *, NSDictionary<NSString *, id> *> *result =
      [NSMutableDictionary dictionary];
  for (NSString *contextKey in safeFields) {
    NSDictionary<NSString *, id> *source = contexts[contextKey];
    if (![source isKindOfClass:NSDictionary.class]) {
      continue;
    }
    NSMutableDictionary<NSString *, id> *safeContext = [NSMutableDictionary dictionary];
    for (NSString *field in safeFields[contextKey]) {
      id value = source[field];
      if ([value isKindOfClass:NSString.class]) {
        NSString *sanitized = OneKeySanitizeCrashString(value);
        if (sanitized.length > 0) {
          safeContext[field] = sanitized;
        }
      } else if ([value isKindOfClass:NSNumber.class]) {
        safeContext[field] = value;
      } else if ([value isKindOfClass:NSArray.class]) {
        NSArray *sourceItems = value;
        NSUInteger itemCount = MIN(
            sourceItems.count,
            OneKeyCrashDiagnosticsMaxTransportFrameCount);
        NSMutableArray<NSString *> *strings = [NSMutableArray array];
        for (NSUInteger index = 0; index < itemCount; index += 1) {
          id item = sourceItems[index];
          NSString *sanitized = [item isKindOfClass:NSString.class]
              ? OneKeySanitizeCrashString(item)
              : nil;
          if (sanitized.length > 0) {
            [strings addObject:sanitized];
          }
        }
        if (strings.count > 0) {
          safeContext[field] = strings;
        }
      }
    }
    if (safeContext.count > 0) {
      result[contextKey] = safeContext;
    }
  }
  return result.count > 0 ? result : nil;
}

static void OneKeySanitizeSentryEventForTransport(SentryEvent *event)
{
  event.message = nil;
  event.error = nil;
  event.startTimestamp = nil;
  event.logger = nil;
  event.serverName = nil;
  event.transaction = nil;
  event.tags = nil;
  event.extra = nil;
  event.modules = nil;
  event.fingerprint = nil;
  event.user = nil;
  event.breadcrumbs = nil;
  event.request = nil;
  event.context = OneKeySafeSentryContexts(event.context);

  NSArray<SentryException *> *allExceptions = event.exceptions ?: @[];
  NSUInteger exceptionStart =
      allExceptions.count > OneKeyCrashDiagnosticsMaxTransportExceptionCount
      ? allExceptions.count - OneKeyCrashDiagnosticsMaxTransportExceptionCount
      : 0;
  NSMutableArray<SentryException *> *exceptions = [NSMutableArray array];
  for (NSUInteger index = exceptionStart; index < allExceptions.count; index += 1) {
    SentryException *exception = allExceptions[index];
    exception.value = nil;
    exception.mechanism.desc = nil;
    exception.mechanism.data = nil;
    exception.mechanism.helpLink = nil;
    OneKeySanitizeStacktraceForTransport(exception.stacktrace);
    [exceptions addObject:exception];
  }
  event.exceptions = exceptions;

  NSMutableArray<SentryThread *> *threads = [NSMutableArray array];
  for (SentryThread *thread in event.threads ?: @[]) {
    thread.name = nil;
    OneKeySanitizeStacktraceForTransport(thread.stacktrace);
    if (thread.crashed.boolValue || thread.current.boolValue || thread.isMain.boolValue) {
      [threads addObject:thread];
      if (threads.count >= OneKeyCrashDiagnosticsMaxTransportThreadCount) {
        break;
      }
    }
  }
  if (threads.count < OneKeyCrashDiagnosticsMaxTransportThreadCount) {
    for (SentryThread *thread in event.threads ?: @[]) {
      if (![threads containsObject:thread]) {
        [threads addObject:thread];
        if (threads.count >= OneKeyCrashDiagnosticsMaxTransportThreadCount) {
          break;
        }
      }
    }
  }
  event.threads = threads;
  OneKeySanitizeStacktraceForTransport(event.stacktrace);

  NSMutableArray<SentryDebugMeta *> *debugMeta = [NSMutableArray array];
  NSUInteger debugCount = MIN(
      event.debugMeta.count,
      OneKeyCrashDiagnosticsMaxTransportDebugImageCount);
  for (NSUInteger index = 0; index < debugCount; index += 1) {
    SentryDebugMeta *image = event.debugMeta[index];
    image.codeFile = OneKeyFileNameOnly(image.codeFile);
    [debugMeta addObject:image];
  }
  event.debugMeta = debugMeta;
}

static id OneKeySanitizeJSONValue(id value);

static NSString *OneKeySanitizeJSONStringValue(NSString *value)
{
  NSString *trimmed = [value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  if ([trimmed hasPrefix:@"{"] || [trimmed hasPrefix:@"["]) {
    NSData *sourceData = [trimmed dataUsingEncoding:NSUTF8StringEncoding];
    id parsed = sourceData.length > 0
        ? [NSJSONSerialization JSONObjectWithData:sourceData options:0 error:nil]
        : nil;
    if ([parsed isKindOfClass:NSDictionary.class] ||
        [parsed isKindOfClass:NSArray.class]) {
      id sanitized = OneKeySanitizeJSONValue(parsed);
      NSData *sanitizedData = [NSJSONSerialization dataWithJSONObject:sanitized
                                                               options:0
                                                                 error:nil];
      if (sanitizedData.length > 0) {
        return [[NSString alloc] initWithData:sanitizedData encoding:NSUTF8StringEncoding];
      }
    }
  }
  return OneKeySanitizeCrashString(value) ?: @"";
}

static id OneKeySanitizeJSONValue(id value)
{
  if (value == nil) {
    return nil;
  }
  if ([value isKindOfClass:NSString.class]) {
    return OneKeySanitizeJSONStringValue(value);
  }
  if ([value isKindOfClass:NSNumber.class] || value == NSNull.null) {
    return value;
  }
  if ([value isKindOfClass:NSArray.class]) {
    NSArray *source = value;
    NSMutableArray *result = [NSMutableArray arrayWithCapacity:source.count];
    for (id item in source) {
      id sanitized = OneKeySanitizeJSONValue(item);
      if (sanitized != nil) {
        [result addObject:sanitized];
      }
    }
    return result;
  }
  if ([value isKindOfClass:NSDictionary.class]) {
    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    for (id key in (NSDictionary *)value) {
      if (![key isKindOfClass:NSString.class]) {
        continue;
      }
      NSString *sanitizedKey = OneKeySanitizeCrashString(key);
      id sanitized = OneKeyIsSensitiveKey(key)
          ? @"[REDACTED]"
          : OneKeySanitizeJSONValue(((NSDictionary *)value)[key]);
      if (sanitizedKey.length > 0 && sanitized != nil) {
        result[sanitizedKey] = sanitized;
      }
    }
    return result;
  }
  return nil;
}

static NSString *OneKeyCrashDiagnosticsDirectory(void)
{
  NSString *cachesDirectory = NSSearchPathForDirectoriesInDomains(
      NSCachesDirectory,
      NSUserDomainMask,
      YES).firstObject;
  return [cachesDirectory stringByAppendingPathComponent:@"logs/crashes"];
}

static void OneKeyRotateCrashReports(
    NSMutableArray<NSDictionary<NSString *, id> *> *reports)
{
  [reports sortUsingComparator:^NSComparisonResult(
      NSDictionary<NSString *, id> *left,
      NSDictionary<NSString *, id> *right) {
    return [right[@"modifiedAt"] compare:left[@"modifiedAt"]];
  }];
  for (NSUInteger index = OneKeyCrashDiagnosticsMaxReportCount;
       index < reports.count;
       index += 1) {
    [NSFileManager.defaultManager removeItemAtPath:reports[index][@"path"] error:nil];
  }
}

static void OneKeyCleanupCrashReports(NSString *directoryPath, NSDate *now)
{
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSArray<NSString *> *names = [fileManager contentsOfDirectoryAtPath:directoryPath error:nil];
  NSMutableArray<NSDictionary<NSString *, id> *> *nativeReports = [NSMutableArray array];
  NSMutableArray<NSDictionary<NSString *, id> *> *javascriptReports = [NSMutableArray array];
  for (NSString *name in names ?: @[]) {
    NSString *path = [directoryPath stringByAppendingPathComponent:name];
    if ([name hasSuffix:@".tmp"]) {
      [fileManager removeItemAtPath:path error:nil];
      continue;
    }
    if (![name hasSuffix:@".json"]) {
      continue;
    }
    NSDictionary<NSFileAttributeKey, id> *attributes =
        [fileManager attributesOfItemAtPath:path error:nil];
    NSDate *modifiedAt = attributes[NSFileModificationDate] ?: NSDate.distantPast;
    if ([now timeIntervalSinceDate:modifiedAt] > OneKeyCrashDiagnosticsMaxReportAge) {
      [fileManager removeItemAtPath:path error:nil];
    } else {
      NSMutableArray<NSDictionary<NSString *, id> *> *reports =
          [name hasPrefix:@"sentry-js-"] ? javascriptReports : nativeReports;
      [reports addObject:@{ @"path": path, @"modifiedAt": modifiedAt }];
    }
  }
  OneKeyRotateCrashReports(nativeReports);
  OneKeyRotateCrashReports(javascriptReports);
}

static BOOL OneKeyWriteCrashDiagnosticsData(
    NSData *data,
    NSString *fileName,
    NSDate *eventDate,
    BOOL replaceExisting)
{
  if (data.length == 0 || fileName.length == 0) {
    return NO;
  }
  @synchronized(NSFileManager.defaultManager) {
    NSString *directoryPath = OneKeyCrashDiagnosticsDirectory();
    NSFileManager *fileManager = NSFileManager.defaultManager;
    [fileManager createDirectoryAtPath:directoryPath
           withIntermediateDirectories:YES
                            attributes:@{
                              NSFileProtectionKey: NSFileProtectionComplete,
                            }
                                 error:nil];
    NSString *path = [directoryPath stringByAppendingPathComponent:fileName];
    if (!replaceExisting && [fileManager fileExistsAtPath:path]) {
      return YES;
    }
    if (![data writeToFile:path options:NSDataWritingAtomic error:nil]) {
      return NO;
    }
    [fileManager setAttributes:@{
      NSFileProtectionKey: NSFileProtectionComplete,
      NSFileModificationDate: eventDate ?: NSDate.date,
    } ofItemAtPath:path error:nil];
    OneKeyCleanupCrashReports(directoryPath, NSDate.date);
    return YES;
  }
}

static BOOL OneKeyMetricKitPayloadHasDiagnostics(MXDiagnosticPayload *payload)
{
  BOOL hasDiagnostics = payload.crashDiagnostics.count > 0 ||
      payload.hangDiagnostics.count > 0 ||
      payload.cpuExceptionDiagnostics.count > 0 ||
      payload.diskWriteExceptionDiagnostics.count > 0;
  if (@available(iOS 16.0, *)) {
    hasDiagnostics = hasDiagnostics || payload.appLaunchDiagnostics.count > 0;
  }
  return hasDiagnostics;
}

static void OneKeyPersistMetricKitPayloads(NSArray<MXDiagnosticPayload *> *payloads)
{
  NSDate *now = NSDate.date;
  OneKeyCleanupCrashReports(OneKeyCrashDiagnosticsDirectory(), now);
  for (MXDiagnosticPayload *payload in payloads ?: @[]) {
    if (!OneKeyMetricKitPayloadHasDiagnostics(payload) ||
        [now timeIntervalSinceDate:payload.timeStampEnd] >
            OneKeyCrashDiagnosticsMaxReportAge) {
      continue;
    }

    id sanitizedPayload = OneKeySanitizeJSONValue(payload.dictionaryRepresentation);
    if (![sanitizedPayload isKindOfClass:NSDictionary.class]) {
      continue;
    }
    NSDictionary<NSString *, id> *report = @{
      @"schemaVersion": @(OneKeyCrashDiagnosticsSchemaVersion),
      @"source": @"metrickit",
      @"platform": @"ios",
      @"capturedAt": OneKeyCrashDateString(now),
      @"payload": sanitizedPayload,
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:report
                                                   options:NSJSONWritingPrettyPrinted
                                                     error:nil];
    long long begin = llround(payload.timeStampBegin.timeIntervalSince1970 * 1000);
    long long end = llround(payload.timeStampEnd.timeIntervalSince1970 * 1000);
    NSString *fileName =
        [NSString stringWithFormat:@"metrickit-%lld-%lld.json", begin, end];
    NSString *filePath =
        [OneKeyCrashDiagnosticsDirectory() stringByAppendingPathComponent:fileName];
    if ([NSFileManager.defaultManager fileExistsAtPath:filePath]) {
      continue;
    }
    OneKeyWriteCrashDiagnosticsData(data, fileName, payload.timeStampEnd, NO);
  }
}

static void OneKeyPersistCrashEvent(SentryEvent *event, BOOL replaceExisting)
{
  @try {
    NSMutableDictionary<NSString *, id> *report = [@{
      @"schemaVersion": @(OneKeyCrashDiagnosticsSchemaVersion),
      @"source": @"sentry",
      @"platform": @"ios",
      @"capturedAt": OneKeyCrashDateString(NSDate.date),
    } mutableCopy];
    NSMutableDictionary<NSString *, id> *serializedEvent = [[event serialize] mutableCopy];
    [serializedEvent removeObjectsForKeys:@[ @"user", @"request" ]];
    id sanitizedEvent = OneKeySanitizeJSONValue(serializedEvent);
    if ([sanitizedEvent isKindOfClass:NSDictionary.class]) {
      report[@"event"] = sanitizedEvent;
    }

    NSData *data = [NSJSONSerialization dataWithJSONObject:report
                                                   options:NSJSONWritingPrettyPrinted
                                                     error:nil];
    NSString *eventId = event.eventId.sentryIdString;
    if (eventId.length == 0) {
      eventId = [NSString stringWithFormat:@"%.0f", NSDate.date.timeIntervalSince1970 * 1000];
    }
    NSString *platform = [serializedEvent[@"platform"] isKindOfClass:NSString.class]
        ? serializedEvent[@"platform"]
        : @"";
    NSString *reportPrefix = [platform caseInsensitiveCompare:@"javascript"] == NSOrderedSame
        ? @"sentry-js-"
        : @"sentry-native-";
    OneKeyWriteCrashDiagnosticsData(
        data,
        [NSString stringWithFormat:@"%@%@.json", reportPrefix, eventId],
        event.timestamp ?: NSDate.date,
        replaceExisting);
  } @catch (NSException *exception) {
    NSLog(@"[OneKeySentryCrashDiagnostics] Failed to persist native crash diagnostics");
  }
}

@interface OneKeyMetricKitDiagnosticsSubscriber : NSObject <MXMetricManagerSubscriber>
+ (instancetype)sharedSubscriber;
- (void)start;
@end

@implementation OneKeyMetricKitDiagnosticsSubscriber

+ (instancetype)sharedSubscriber
{
  static OneKeyMetricKitDiagnosticsSubscriber *subscriber;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    subscriber = [[OneKeyMetricKitDiagnosticsSubscriber alloc] init];
  });
  return subscriber;
}

- (void)start
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    MXMetricManager *manager = MXMetricManager.sharedManager;
    [manager addSubscriber:self];
    dispatch_async(OneKeyCrashDiagnosticsQueue(), ^{
      OneKeyPersistMetricKitPayloads(manager.pastDiagnosticPayloads);
    });
  });
}

- (void)didReceiveDiagnosticPayloads:(NSArray<MXDiagnosticPayload *> *)payloads
{
  NSArray<MXDiagnosticPayload *> *payloadCopy = [payloads copy];
  dispatch_async(OneKeyCrashDiagnosticsQueue(), ^{
    OneKeyPersistMetricKitPayloads(payloadCopy);
  });
}

@end

BOOL OneKeyInitializeSentryCrashDiagnostics(NSString *dsn)
{
  [[OneKeyMetricKitDiagnosticsSubscriber sharedSubscriber] start];
  static BOOL initialized = NO;
  static NSObject *initializationLock;
  static dispatch_once_t lockOnceToken;
  dispatch_once(&lockOnceToken, ^{
    initializationLock = [[NSObject alloc] init];
  });
  @synchronized(initializationLock) {
    if (initialized) {
      return YES;
    }
    if (![dsn isKindOfClass:NSString.class] || dsn.length == 0) {
      return NO;
    }

    __block BOOL didStart = NO;
    void (^startSentry)(void) = ^{
      NSError *optionsError = nil;
      SentryOptions *options =
          [RNSentryStart createOptionsWithDictionary:@{ @"dsn": dsn }
                                               error:&optionsError];
      if (options == nil || optionsError != nil) {
        NSLog(@"[OneKeySentryCrashDiagnostics] Failed to create Sentry options");
        return;
      }
      [RNSentryStart updateWithReactDefaults:options];
      options.enabled = YES;
      options.maxBreadcrumbs = 100;
      options.maxCacheItems = 60;
      options.enableAppHangTracking = YES;
      options.appHangTimeoutInterval = 5.0;
      options.enableCrashHandler = YES;
      options.enableWatchdogTerminationTracking = NO;
      options.attachScreenshot = NO;
      options.attachViewHierarchy = NO;
      options.sendDefaultPii = NO;
      SentryBeforeSendEventCallback existingBeforeSend = options.beforeSend;
      options.beforeSend = ^SentryEvent *(SentryEvent *event) {
        SentryEvent *preparedEvent = existingBeforeSend == nil
            ? event
            : existingBeforeSend(event);
        if (preparedEvent != nil) {
          if (preparedEvent.level == kSentryLevelFatal) {
            OneKeyPersistCrashEvent(preparedEvent, YES);
          }
          OneKeySanitizeSentryEventForTransport(preparedEvent);
        }
        return preparedEvent;
      };
      options.onCrashedLastRun = ^(SentryEvent *event) {
        dispatch_async(OneKeyCrashDiagnosticsQueue(), ^{
          OneKeyPersistCrashEvent(event, NO);
        });
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
    return didStart;
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
  NSString *dsn = [configuration[@"dsn"] isKindOfClass:NSString.class]
      ? configuration[@"dsn"]
      : @"";
  return @(OneKeyInitializeSentryCrashDiagnostics(dsn));
}

@end
