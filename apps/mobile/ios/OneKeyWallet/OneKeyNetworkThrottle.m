#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTHTTPRequestHandler.h>
#import <math.h>
#import <stdatomic.h>

static NSString *const OneKeyNetworkThrottleHandledKey = @"OneKeyNetworkThrottleHandled";
static NSString *const OneKeyNetworkThrottleProfileSlow4G = @"slow4g";
static const NSTimeInterval OneKeyNetworkThrottleDefaultLatencyMs = 562.5;

@interface OneKeyNetworkThrottleState : NSObject
+ (NSDictionary *)currentConfig;
+ (BOOL)isEnabled;
+ (NSTimeInterval)latencyMs;
+ (NSDictionary *)setEnabled:(BOOL)enabled latencyMs:(NSTimeInterval)latencyMs;
@end

@implementation OneKeyNetworkThrottleState

static atomic_bool _oneKeyNetworkThrottleEnabled = ATOMIC_VAR_INIT(false);
static atomic_llong _oneKeyNetworkThrottleLatencyMicros = ATOMIC_VAR_INIT(562500);

+ (NSDictionary *)currentConfig
{
  BOOL enabled = atomic_load_explicit(&_oneKeyNetworkThrottleEnabled, memory_order_acquire);
  NSTimeInterval latencyMs =
    ((NSTimeInterval)atomic_load_explicit(&_oneKeyNetworkThrottleLatencyMicros, memory_order_relaxed)) / 1000.0;
  return @{
    @"enabled": @(enabled),
    @"profile": OneKeyNetworkThrottleProfileSlow4G,
    @"latencyMs": @(latencyMs)
  };
}

+ (BOOL)isEnabled
{
  return atomic_load_explicit(&_oneKeyNetworkThrottleEnabled, memory_order_acquire);
}

+ (NSTimeInterval)latencyMs
{
  return ((NSTimeInterval)atomic_load_explicit(&_oneKeyNetworkThrottleLatencyMicros, memory_order_relaxed)) / 1000.0;
}

+ (NSDictionary *)setEnabled:(BOOL)enabled latencyMs:(NSTimeInterval)latencyMs
{
  NSTimeInterval normalizedLatencyMs = latencyMs > 0 ? latencyMs : OneKeyNetworkThrottleDefaultLatencyMs;
  atomic_store_explicit(
    &_oneKeyNetworkThrottleLatencyMicros,
    (long long)llround(normalizedLatencyMs * 1000.0),
    memory_order_relaxed
  );
  atomic_store_explicit(&_oneKeyNetworkThrottleEnabled, enabled, memory_order_release);
  NSLog(
    @"[onekey-network-throttle] native config enabled=%@ profile=%@ latencyMs=%.1f",
    enabled ? @"true" : @"false",
    OneKeyNetworkThrottleProfileSlow4G,
    normalizedLatencyMs
  );
  return [self currentConfig];
}

@end

@interface OneKeyNetworkThrottleURLProtocol : NSURLProtocol <NSURLSessionDataDelegate>
@property (nonatomic, strong) NSURLSessionDataTask *task;
@property (nonatomic, strong) NSURLSession *session;
@property (atomic, assign) BOOL stopped;
@end

@implementation OneKeyNetworkThrottleURLProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest *)request
{
  if (![OneKeyNetworkThrottleState isEnabled]) {
    return NO;
  }
  if ([NSURLProtocol propertyForKey:OneKeyNetworkThrottleHandledKey inRequest:request]) {
    return NO;
  }
  NSString *scheme = request.URL.scheme.lowercaseString;
  return [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"];
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request
{
  return request;
}

- (void)startLoading
{
  NSMutableURLRequest *request = [self.request mutableCopy];
  [NSURLProtocol setProperty:@YES forKey:OneKeyNetworkThrottleHandledKey inRequest:request];

  NSTimeInterval delay = [OneKeyNetworkThrottleState latencyMs] / 1000.0;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    if (self.stopped) {
      return;
    }
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    configuration.HTTPShouldSetCookies = YES;
    configuration.HTTPCookieAcceptPolicy = NSHTTPCookieAcceptPolicyAlways;
    configuration.HTTPCookieStorage = [NSHTTPCookieStorage sharedHTTPCookieStorage];
    self.session = [NSURLSession sessionWithConfiguration:configuration delegate:self delegateQueue:nil];
    self.task = [self.session dataTaskWithRequest:request];
    [self.task resume];
  });
}

- (void)stopLoading
{
  self.stopped = YES;
  [self.task cancel];
  [self.session invalidateAndCancel];
  self.task = nil;
  self.session = nil;
}

- (void)URLSession:(NSURLSession *)session
                          task:(NSURLSessionTask *)task
    willPerformHTTPRedirection:(NSHTTPURLResponse *)response
                    newRequest:(NSURLRequest *)request
             completionHandler:(void (^)(NSURLRequest * _Nullable))completionHandler
{
  [self.client URLProtocol:self wasRedirectedToRequest:request redirectResponse:response];
  completionHandler(nil);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler
{
  [self.client URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)dataTask didReceiveData:(NSData *)data
{
  [self.client URLProtocol:self didLoadData:data];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error
{
  if (error) {
    [self.client URLProtocol:self didFailWithError:error];
  } else {
    [self.client URLProtocolDidFinishLoading:self];
  }
}

@end

@interface OneKeyNetworkThrottleInstaller : NSObject
@end

@implementation OneKeyNetworkThrottleInstaller

+ (void)load
{
  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration *{
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    NSNumber *useWifiOnly = [[NSBundle mainBundle].infoDictionary objectForKey:@"ReactNetworkForceWifiOnly"];
    if (useWifiOnly) {
      configuration.allowsCellularAccess = ![useWifiOnly boolValue];
    }
    configuration.HTTPShouldSetCookies = YES;
    configuration.HTTPCookieAcceptPolicy = NSHTTPCookieAcceptPolicyAlways;
    configuration.HTTPCookieStorage = [NSHTTPCookieStorage sharedHTTPCookieStorage];

    NSArray<Class> *existingProtocolClasses = configuration.protocolClasses ?: @[];
    if (![existingProtocolClasses containsObject:[OneKeyNetworkThrottleURLProtocol class]]) {
      configuration.protocolClasses = [[@[ [OneKeyNetworkThrottleURLProtocol class] ] arrayByAddingObjectsFromArray:existingProtocolClasses] copy];
    }
    return configuration;
  });
}

@end

@interface OneKeyNetworkThrottle : NSObject <RCTBridgeModule>
@end

@implementation OneKeyNetworkThrottle

RCT_EXPORT_MODULE(OneKeyNetworkThrottle)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(getConfig, getConfigWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([OneKeyNetworkThrottleState currentConfig]);
}

RCT_REMAP_METHOD(setConfig, setConfig:(NSDictionary *)config resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL enabled = [config[@"enabled"] boolValue];
  NSNumber *latencyValue = config[@"latencyMs"];
  NSTimeInterval latencyMs = latencyValue != nil ? [latencyValue doubleValue] : OneKeyNetworkThrottleDefaultLatencyMs;
  resolve([OneKeyNetworkThrottleState setEnabled:enabled latencyMs:latencyMs]);
}

@end
