#import "HTTPServerManager.h"
#import "GCDWebServerURLEncodedFormRequest.h"
#import "GCDWebServer.h"
#import "GCDWebServerDataResponse.h"
#import "NSString+OKAdd.h"

@interface HTTPServerManager ()

@property(nonatomic,strong)GCDWebServer *webServer;
@property(nonatomic,strong)NSMutableDictionary *completionBlocks;;


@end
@implementation HTTPServerManager

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
  if ([type isEqualToString:@"GET"]) {
    [server addDefaultHandlerForMethod:type requestClass:[GCDWebServerRequest class] asyncProcessBlock:^(__kindof GCDWebServerRequest * _Nonnull request, GCDWebServerCompletionBlock  _Nonnull completionBlock) {
      NSString *requestId = [NSString generateRequestId];
      @synchronized (self) {
        [weakSelf.completionBlocks setObject:completionBlock forKey:requestId];
      }
      @try {
        [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                     @"type": type,
                                                                     @"url": request.URL.relativeString}];
      } @catch (NSException *exception) {
        [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                     @"type": type,
                                                                     @"url": request.URL.relativeString}];
      }
    }];
  } else if ([type isEqualToString:@"POST"]) {
    [server addDefaultHandlerForMethod:type requestClass:[GCDWebServerURLEncodedFormRequest class] asyncProcessBlock:^(__kindof GCDWebServerURLEncodedFormRequest * _Nonnull request, GCDWebServerCompletionBlock  _Nonnull completionBlock) {
      NSString *requestId = [NSString generateRequestId];
      @synchronized (self) {
        [weakSelf.completionBlocks setObject:completionBlock forKey:requestId];
      }
      @try {
        NSString *body = [[NSString alloc] initWithData:request.data encoding:NSUTF8StringEncoding];
        [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                     @"postData": body,
                                                                     @"type": type,
                                                                     @"url": request.URL.relativeString}];
      } @catch (NSException *exception) {
        [weakSelf sendEventWithName:@"httpServerResponseReceived" body:@{@"requestId": requestId,
                                                                     @"type": type,
                                                                     @"url": request.URL.relativeString}];
      }
    }];
  }
}

RCT_EXPORT_METHOD(start:(NSInteger) port
                  serviceName:(NSString *)serviceName callback:(RCTResponseSenderBlock)callback) {
  __weak typeof(self) weakSelf = self;

  dispatch_sync(dispatch_get_main_queue(), ^{
    if (!weakSelf.webServer.isRunning) {
      weakSelf.webServer = [[GCDWebServer alloc] init];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"POST"];
      [weakSelf initResponseReceivedFor:weakSelf.webServer forType:@"GET"];
      [weakSelf.webServer startWithPort:port bonjourName:serviceName];
    }
    if (weakSelf.webServer.serverURL.absoluteString) {
      callback(@[weakSelf.webServer.serverURL.absoluteString,@(true)]);
    } else {
      callback(@[[NSNull null],@(false)]);
    }
  });
}

RCT_EXPORT_METHOD(stop)
{
    RCTLogInfo(@"Stopping HTTP bridge server");

    if (_webServer != nil) {
      if (_webServer.isRunning) {
        [_webServer stop];
      }
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
    [requestResponse setValue:@"*" forAdditionalHeader:@"Access-Control-Allow-Origin"];
    [requestResponse setValue:@"X-Requested-With, Content-Type" forAdditionalHeader:@"Access-Control-Allow-Headers"];
    [requestResponse setValue:@"GET, POST, OPTIONS" forAdditionalHeader:@"Access-Control-Allow-Methods"];
    requestResponse.statusCode = 200;

    GCDWebServerCompletionBlock completionBlock = nil;
    @synchronized (self) {
        completionBlock = [_completionBlocks objectForKey:requestId];
        [_completionBlocks removeObjectForKey:requestId];
    }

    completionBlock(requestResponse);
}

@end
