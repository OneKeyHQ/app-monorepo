#import <Foundation/Foundation.h>
#import <Sentry/Sentry.h>
#import <Sentry/SentryEvent.h>
#import <Sentry/SentryId.h>

static NSUInteger const OneKeyCrashDiagnosticsMaxReportCount = 5;
static NSTimeInterval const OneKeyCrashDiagnosticsMaxReportAge = 7 * 24 * 60 * 60;

static dispatch_queue_t OneKeyCrashDiagnosticsQueue(void)
{
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    dispatch_queue_attr_t attributes = dispatch_queue_attr_make_with_qos_class(
        DISPATCH_QUEUE_SERIAL,
        QOS_CLASS_UTILITY,
        0);
    queue = dispatch_queue_create("so.onekey.crash-diagnostics", attributes);
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
        [NSCharacterSet characterSetWithCharactersInString:@" \t\r\n,[]\"'\\"];
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
  static NSSet<NSString *> *nonSensitiveTokenKeys;
  static dispatch_once_t tokenKeyOnceToken;
  dispatch_once(&tokenKeyOnceToken, ^{
    nonSensitiveTokenKeys = [NSSet setWithArray:@[
      @"tokensymbol", @"tokentype", @"tokenname", @"tokendecimals", @"tokennetwork",
    ]];
  });
  if ([nonSensitiveTokenKeys containsObject:normalized]) {
    return NO;
  }
  NSArray<NSString *> *markers = @[
    @"password", @"passwd", @"passphrase", @"secret", @"token",
    @"auth", @"authentication", @"authorization", @"cookie", @"session", @"sessionid",
    @"apikey", @"privatekey", @"pinhash", @"backendshare",
    @"mnemonic", @"seed", @"recoveryphrase", @"credential", @"bearer",
    @"email", @"username", @"phone", @"fullname", @"deviceid",
    @"installationid", @"userid", @"ipaddress", @"clientip",
  ];
  for (NSString *marker in markers) {
    if ([normalized containsString:marker]) {
      return YES;
    }
  }
  return NO;
}

static NSString *OneKeySanitizeCrashString(NSString *value)
{
  if (value.length == 0) {
    return value;
  }

  NSString *result = OneKeyRedactMnemonicSequences(value);
  static NSArray<NSRegularExpression *> *sensitiveValuePatterns;
  static NSArray<NSString *> *sensitiveValueReplacements;
  static NSRegularExpression *authHeaderPattern;
  static NSRegularExpression *bearerPattern;
  static NSRegularExpression *basicAuthPattern;
  static NSRegularExpression *urlPattern;
  static dispatch_once_t sensitiveValueOnceToken;
  dispatch_once(&sensitiveValueOnceToken, ^{
    NSString *sensitiveLabels =
        @"password|passwd|passphrase|secret|token|auth(?:entication)?|authorization|cookie|session(?:id)?|"
         "api[-_]?key|private[-_]?key|pin[-_]?hash|backend[-_]?share|mnemonic|seed(?:[-_ ]?phrase)?|"
         "recovery(?:[-_ ]?phrase)?|credential|email|username|phone|full[-_ ]?name|"
         "device[-_ ]?id|installation[-_ ]?id|user[-_ ]?id|ip[-_ ]?address|client[-_ ]?ip";
    NSArray<NSString *> *rawPatterns = @[
      [NSString stringWithFormat:@"(?i)([\\\"']?(?:%@)[\\\"']?\\s*[:=]\\s*)[\\[{][\\s\\S]*", sensitiveLabels],
      [NSString stringWithFormat:@"(?i)([\\\"']?(?:%@)[\\\"']?\\s*[:=]\\s*)\\\"[^\\\"]*\\\"", sensitiveLabels],
      [NSString stringWithFormat:@"(?i)([\\\"']?(?:%@)[\\\"']?\\s*[:=]\\s*)'[^']*'", sensitiveLabels],
      [NSString stringWithFormat:@"(?i)([\\\"']?(?:%@)[\\\"']?\\s*[:=]\\s*)[^,;}\\r\\n]+", sensitiveLabels],
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
    authHeaderPattern = [NSRegularExpression
        regularExpressionWithPattern:@"(?i)(\\b(?:authorization|proxy-authorization|cookie|set-cookie)\\s*[:=]\\s*)[^\\r\\n]+"
                              options:0
                                error:nil];
    bearerPattern = [NSRegularExpression
        regularExpressionWithPattern:@"(?i)(\\bbearer\\s+)[A-Za-z0-9._~+/-]+=*"
                              options:0
                                error:nil];
    basicAuthPattern = [NSRegularExpression
        regularExpressionWithPattern:@"(?i)(\\bbasic\\s+)[A-Za-z0-9+/]+=*"
                              options:0
                                error:nil];
    urlPattern = [NSRegularExpression
        regularExpressionWithPattern:@"(?i)(\\b(?:https?|wss?)://)(?:[^@\\s/]+@)?([^\\s/?#]+)([^\\s?#]*)[^\\s]*"
                              options:0
                                error:nil];
  });
  result = [authHeaderPattern stringByReplacingMatchesInString:result
                                                       options:0
                                                         range:NSMakeRange(0, result.length)
                                                  withTemplate:@"$1[REDACTED]"];
  result = [bearerPattern stringByReplacingMatchesInString:result
                                                   options:0
                                                     range:NSMakeRange(0, result.length)
                                              withTemplate:@"$1[REDACTED]"];
  result = [basicAuthPattern stringByReplacingMatchesInString:result
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
      @"(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
      @"\\b0x[0-9a-fA-F]{40,64}\\b",
      @"\\b(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{128})\\b",
      @"\\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\\b",
      @"\\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\\b",
      @"(?i)\\b(?:[a-z0-9]{1,20}1)[a-z0-9]{20,90}\\b",
      @"\\b[1-9A-HJ-NP-Za-km-z]{32,128}\\b",
      @"\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b",
      @"(?i)\\b(?:mnemonic|seed(?:\\s+phrase)?)\\s*[=:]\\s*(?:\\p{L}{2,16}[\\s,]+){2,}\\p{L}{2,16}\\b",
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
  result = [urlPattern stringByReplacingMatchesInString:result
                                                options:0
                                                  range:NSMakeRange(0, result.length)
                                           withTemplate:@"$1$2$3"];
  for (NSRegularExpression *pattern in patterns) {
    result = [pattern stringByReplacingMatchesInString:result
                                               options:0
                                                 range:NSMakeRange(0, result.length)
                                          withTemplate:@"[REDACTED]"];
  }
  return result;
}

static id OneKeySanitizeJSONValue(id value, NSString *containerKey);

static NSIndexSet *OneKeyMnemonicWordIndexesInArray(NSArray *source)
{
  if (OneKeyMnemonicWords().count == 0) {
    return NSIndexSet.indexSet;
  }
  NSMutableIndexSet *sensitiveIndexes = [NSMutableIndexSet indexSet];
  NSMutableIndexSet *sequence = [NSMutableIndexSet indexSet];
  void (^retainSequence)(void) = ^{
    if (sequence.count >= 3) {
      [sensitiveIndexes addIndexes:sequence];
    }
    [sequence removeAllIndexes];
  };
  [source enumerateObjectsUsingBlock:^(id item, NSUInteger index, BOOL *stop) {
    BOOL isMnemonicWord = NO;
    if ([item isKindOfClass:NSString.class]) {
      NSString *word = [[item stringByTrimmingCharactersInSet:
          NSCharacterSet.whitespaceAndNewlineCharacterSet] lowercaseString];
      isMnemonicWord = [OneKeyMnemonicWords() containsObject:word];
    }
    if (isMnemonicWord) {
      [sequence addIndex:index];
    } else {
      retainSequence();
    }
  }];
  retainSequence();
  return [sensitiveIndexes copy];
}

static NSString *OneKeySanitizeJSONStringValue(NSString *value)
{
  NSString *trimmed =
      [value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  if ([trimmed hasPrefix:@"{"] || [trimmed hasPrefix:@"["]) {
    NSData *sourceData = [trimmed dataUsingEncoding:NSUTF8StringEncoding];
    id parsed = sourceData.length > 0
        ? [NSJSONSerialization JSONObjectWithData:sourceData options:0 error:nil]
        : nil;
    if ([parsed isKindOfClass:NSDictionary.class] || [parsed isKindOfClass:NSArray.class]) {
      id sanitized = OneKeySanitizeJSONValue(parsed, nil);
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

static NSString *OneKeyNormalizeKey(NSString *key)
{
  return [[[key lowercaseString]
      componentsSeparatedByCharactersInSet:NSCharacterSet.alphanumericCharacterSet.invertedSet]
      componentsJoinedByString:@""];
}

static BOOL OneKeyIsSensitiveChildKey(NSString *containerKey, NSString *key)
{
  NSString *normalizedContainer = OneKeyNormalizeKey(containerKey ?: @"");
  NSString *normalizedKey = OneKeyNormalizeKey(key);
  if ([normalizedContainer isEqualToString:@"user"]) {
    return [@[ @"id", @"name", @"segment" ] containsObject:normalizedKey];
  }
  if ([normalizedContainer isEqualToString:@"device"]) {
    return [@[ @"id", @"name" ] containsObject:normalizedKey];
  }
  return NO;
}

static BOOL OneKeyIsOmittedTopLevelKey(NSString *key)
{
  NSString *normalized = OneKeyNormalizeKey(key);
  return [normalized isEqualToString:@"user"] || [normalized isEqualToString:@"request"];
}

static BOOL OneKeyStringMatchesPattern(NSString *value, NSString *pattern)
{
  NSRegularExpression *expression =
      [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil];
  return expression != nil &&
      [expression firstMatchInString:value
                             options:0
                               range:NSMakeRange(0, value.length)] != nil;
}

static BOOL OneKeyIsValidTechnicalIdentifier(NSString *key, NSString *value)
{
  NSString *normalizedKey = OneKeyNormalizeKey(key);
  if ([normalizedKey isEqualToString:@"eventid"] ||
      [normalizedKey isEqualToString:@"traceid"]) {
    return OneKeyStringMatchesPattern(value, @"(?i)\\A[0-9a-f]{32}\\z");
  }
  if ([normalizedKey isEqualToString:@"spanid"] ||
      [normalizedKey isEqualToString:@"parentspanid"]) {
    return OneKeyStringMatchesPattern(value, @"(?i)\\A[0-9a-f]{16}\\z");
  }
  if ([normalizedKey isEqualToString:@"debugid"]) {
    return OneKeyStringMatchesPattern(
        value,
        @"(?i)\\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\z");
  }
  if ([normalizedKey isEqualToString:@"codeid"]) {
    return OneKeyStringMatchesPattern(value, @"(?i)\\A[0-9a-f]{8,64}\\z");
  }
  if ([normalizedKey isEqualToString:@"imageaddr"] ||
      [normalizedKey isEqualToString:@"instructionaddr"] ||
      [normalizedKey isEqualToString:@"symboladdr"]) {
    return OneKeyStringMatchesPattern(value, @"(?i)\\A(?:0x)?[0-9a-f]{1,16}\\z");
  }
  return NO;
}

static id OneKeySanitizeJSONValue(id value, NSString *containerKey)
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
    NSIndexSet *mnemonicWordIndexes = OneKeyMnemonicWordIndexesInArray(source);
    [source enumerateObjectsUsingBlock:^(id item, NSUInteger index, BOOL *stop) {
      id sanitized = [mnemonicWordIndexes containsIndex:index]
          ? @"[REDACTED]"
          : OneKeySanitizeJSONValue(item, containerKey);
      if (sanitized != nil) {
        [result addObject:sanitized];
      }
    }];
    return result;
  }
  if ([value isKindOfClass:NSDictionary.class]) {
    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    for (id key in (NSDictionary *)value) {
      if (![key isKindOfClass:NSString.class]) {
        continue;
      }
      if (containerKey == nil && OneKeyIsOmittedTopLevelKey(key)) {
        continue;
      }
      NSString *sanitizedKey = OneKeySanitizeCrashString(key);
      id child = ((NSDictionary *)value)[key];
      id sanitized;
      if (OneKeyIsSensitiveKey(key) || OneKeyIsSensitiveChildKey(containerKey, key)) {
        sanitized = @"[REDACTED]";
      } else if ([child isKindOfClass:NSString.class] &&
                 OneKeyIsValidTechnicalIdentifier(key, child)) {
        sanitized = child;
      } else {
        sanitized = OneKeySanitizeJSONValue(child, key);
      }
      if (sanitizedKey.length > 0 && sanitized != nil) {
        result[sanitizedKey] = sanitized;
      }
    }
    return result;
  }
  return OneKeySanitizeCrashString([value description]);
}

static NSString *OneKeyCrashDateString(NSDate *date)
{
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

static void OneKeyCleanupCrashReports(NSString *directoryPath, NSDate *now)
{
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSArray<NSString *> *names = [fileManager contentsOfDirectoryAtPath:directoryPath error:nil];
  NSMutableArray<NSDictionary<NSString *, id> *> *retained = [NSMutableArray array];
  for (NSString *name in names ?: @[]) {
    NSString *path = [directoryPath stringByAppendingPathComponent:name];
    if ([name hasSuffix:@".tmp"]) {
      [fileManager removeItemAtPath:path error:nil];
      continue;
    }
    if (![name hasPrefix:@"sentry-native-"] || ![name hasSuffix:@".json"]) {
      continue;
    }
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

static void OneKeyScheduleCrashReportCleanup(void)
{
  dispatch_async(OneKeyCrashDiagnosticsQueue(), ^{
    @synchronized(NSFileManager.defaultManager) {
      NSString *cachesDirectory = NSSearchPathForDirectoriesInDomains(
          NSCachesDirectory,
          NSUserDomainMask,
          YES).firstObject;
      NSString *directoryPath = [cachesDirectory stringByAppendingPathComponent:@"logs/crashes"];
      BOOL isDirectory = NO;
      if ([NSFileManager.defaultManager fileExistsAtPath:directoryPath
                                             isDirectory:&isDirectory] && isDirectory) {
        OneKeyCleanupCrashReports(directoryPath, NSDate.date);
      }
    }
  });
}

static BOOL OneKeyWriteCrashDiagnosticsData(
    NSData *data,
    NSString *fileName,
    NSDate *eventDate)
{
  if (data.length == 0 || fileName.length == 0) {
    return NO;
  }
  @synchronized(NSFileManager.defaultManager) {
    NSString *cachesDirectory = NSSearchPathForDirectoriesInDomains(
        NSCachesDirectory,
        NSUserDomainMask,
        YES).firstObject;
    NSString *directoryPath = [cachesDirectory stringByAppendingPathComponent:@"logs/crashes"];
    NSFileManager *fileManager = NSFileManager.defaultManager;
    [fileManager createDirectoryAtPath:directoryPath
           withIntermediateDirectories:YES
                            attributes:@{
                              NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication,
                            }
                                 error:nil];
    [fileManager setAttributes:@{
      NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication,
    } ofItemAtPath:directoryPath error:nil];
    NSString *path = [directoryPath stringByAppendingPathComponent:fileName];
    if (![data writeToFile:path options:NSDataWritingAtomic error:nil]) {
      return NO;
    }
    [fileManager setAttributes:@{
      NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication,
      NSFileModificationDate: eventDate,
    } ofItemAtPath:path error:nil];
    OneKeyCleanupCrashReports(directoryPath, NSDate.date);
    return YES;
  }
}

static void OneKeyPersistNativeSentryCrashSnapshot(
    NSData *eventSnapshot,
    NSString *eventId,
    NSDate *eventDate)
{
  if (eventSnapshot.length == 0 || eventId.length == 0) {
    return;
  }
  @try {
    id serializedEvent = [NSJSONSerialization JSONObjectWithData:eventSnapshot
                                                         options:0
                                                           error:nil];
    if (![serializedEvent isKindOfClass:NSDictionary.class]) {
      return;
    }
    id sanitizedEvent = OneKeySanitizeJSONValue(serializedEvent, nil);
    if (![sanitizedEvent isKindOfClass:NSDictionary.class]) {
      return;
    }
    NSDictionary<NSString *, id> *report = @{
      @"schemaVersion": @1,
      @"source": @"sentry",
      @"platform": @"ios",
      @"capturedAt": OneKeyCrashDateString(NSDate.date),
      @"event": sanitizedEvent,
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:report
                                                   options:NSJSONWritingPrettyPrinted
                                                     error:nil];
    if (!OneKeyWriteCrashDiagnosticsData(
        data,
        [NSString stringWithFormat:@"sentry-native-%@.json", eventId],
        eventDate)) {
      NSLog(@"[OneKeyCrashDiagnostics] Failed to write native crash diagnostics");
    }
  } @catch (NSException *exception) {
    NSLog(@"[OneKeyCrashDiagnostics] Failed to persist native crash diagnostics");
  }
}

static void OneKeyScheduleNativeSentryCrashEvent(SentryEvent *event)
{
  NSString *eventPlatform = event.platform;
  if (event.level != kSentryLevelFatal ||
      (eventPlatform != nil &&
       [eventPlatform caseInsensitiveCompare:@"javascript"] == NSOrderedSame)) {
    return;
  }
  for (SentryException *exception in event.exceptions) {
    if (exception.value != nil &&
        [exception.value rangeOfString:@"ExceptionsManager.reportException"].location != NSNotFound) {
      return;
    }
  }
  @try {
    NSDictionary<NSString *, id> *serializedEvent = [event serialize];
    NSData *eventSnapshot = [NSJSONSerialization dataWithJSONObject:serializedEvent
                                                            options:0
                                                              error:nil];
    if (eventSnapshot.length == 0) {
      return;
    }
    NSString *eventId = [event.eventId.sentryIdString copy];
    if (eventId.length == 0) {
      eventId = [NSString stringWithFormat:@"%.0f", NSDate.date.timeIntervalSince1970 * 1000];
    }
    NSDate *eventDate = [event.timestamp copy] ?: NSDate.date;
    dispatch_async(OneKeyCrashDiagnosticsQueue(), ^{
      @autoreleasepool {
        OneKeyPersistNativeSentryCrashSnapshot(eventSnapshot, eventId, eventDate);
      }
    });
  } @catch (NSException *exception) {
    NSLog(@"[OneKeyCrashDiagnostics] Failed to snapshot native crash diagnostics");
  }
}

void OneKeyConfigureNativeSentryCrashDiagnostics(id optionsValue)
{
  if (![optionsValue respondsToSelector:NSSelectorFromString(@"setBeforeSend:")]) {
    return;
  }
  @try {
    SentryBeforeSendEventCallback existingBeforeSend =
        [optionsValue valueForKey:@"beforeSend"];
    SentryBeforeSendEventCallback crashDiagnosticsBeforeSend =
        ^SentryEvent *(SentryEvent *event) {
      SentryEvent *preparedEvent =
          existingBeforeSend == nil ? event : existingBeforeSend(event);
      if (preparedEvent != nil) {
        OneKeyScheduleNativeSentryCrashEvent(preparedEvent);
      }
      return preparedEvent;
    };
    [optionsValue setValue:[crashDiagnosticsBeforeSend copy] forKey:@"beforeSend"];
    OneKeyScheduleCrashReportCleanup();
  } @catch (NSException *exception) {
    NSLog(@"[OneKeyCrashDiagnostics] Failed to configure native crash diagnostics");
  }
}
