#import "RCTHTTPServerManager.h"
#include <stdlib.h>


@interface RCTHTTPServerManager ()

@property(nonatomic,strong)GCDWebServer *webServer;
@property(nonatomic,strong)NSMutableDictionary *completionBlocks;;


@end
@implementation RCTHTTPServerManager

RCT_EXPORT_MODULE();

-(NSMutableDictionary *)completionBlocks {
  if (!_completionBlocks) {
    _completionBlocks = [NSMutableDictionary dictionary];
  }
  return _completionBlocks;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"httpServerResponseReceived"];
}

- (void)initResponseReceivedFor:(GCDWebServer *)server forType:(NSString*)type {
  __weak typeof(self) weakSelf = self;

  [server addDefaultHandlerForMethod:type requestClass:[GCDWebServerRequest class] asyncProcessBlock:^(__kindof GCDWebServerRequest * _Nonnull request, GCDWebServerCompletionBlock  _Nonnull completionBlock) {
    long long milliseconds = (long long)([[NSDate date] timeIntervalSince1970] * 1000.0);
    int r = arc4random_uniform(1000000);
    NSString *requestId = [NSString stringWithFormat:@"%lld:%d", milliseconds, r];
    @synchronized (self) {
      [weakSelf.completionBlocks setObject:completionBlock forKey:requestId];
    }
    @try {
        if ([GCDWebServerTruncateHeaderValue(request.contentType) isEqualToString:@"application/json"]) {
          GCDWebServerDataRequest* dataRequest = (GCDWebServerDataRequest*)request;
          [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                       @"postData": dataRequest.jsonObject,
                                                                       @"type": type,
                                                                       @"url": request.URL.relativeString}];
        } else {
          [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                       @"type": type,
                                                                       @"url": request.URL.relativeString}];
        }
    } @catch (NSException *exception) {
      [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                   @"type": type,
                                                                   @"url": request.URL.relativeString}];
    }
  }];
}

RCT_EXPORT_METHOD(start:(NSInteger) port
                  serviceName:(NSString *) serviceName) {
  RCTLogInfo(@"Running HTTP bridge server: %ld", port);
  __weak typeof(self) weakSelf = self;

  dispatch_sync(dispatch_get_main_queue(), ^{
    if (!weakSelf.webServer.isRunning) {
      weakSelf.webServer = [[GCDWebServer alloc] init];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"POST"];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"PUT"];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"GET"];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"DELETE"];
      [weakSelf.webServer startWithPort:port bonjourName:serviceName];
      NSLog(@"Visit %@ in your web browser", weakSelf.webServer.serverURL);
    }
  });
}

RCT_EXPORT_METHOD(stop)
{
    RCTLogInfo(@"Stopping HTTP bridge server");

    if (_webServer != nil) {
        [_webServer stop];
        [_webServer removeAllHandlers];
        _webServer = nil;
        _completionBlocks = nil;
    }
}

RCT_EXPORT_METHOD(respond: (NSString *) requestId
                  code: (NSInteger) code
                  type: (NSString *) type
                  body: (NSString *) body)
{
    NSData* data = [body dataUsingEncoding:NSUTF8StringEncoding];
    GCDWebServerDataResponse* requestResponse = [[GCDWebServerDataResponse alloc] initWithData:data contentType:type];
    requestResponse.statusCode = code;

    GCDWebServerCompletionBlock completionBlock = nil;
    @synchronized (self) {
        completionBlock = [_completionBlocks objectForKey:requestId];
        [_completionBlocks removeObjectForKey:requestId];
    }

    completionBlock(requestResponse);
}

NSString* GCDWebServerTruncateHeaderValue(NSString* value) {
  if (value) {
    NSRange range = [value rangeOfString:@";"];
    if (range.location != NSNotFound) {
      return [value substringToIndex:range.location];
    }
  }
  return value;
}

@end
