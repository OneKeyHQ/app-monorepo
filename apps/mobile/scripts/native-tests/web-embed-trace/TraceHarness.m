#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import <os/log.h>
#import <CoreFoundation/CoreFoundation.h>
#import "TraceConfig.h"

static NSMutableArray *Captured;
static NSMutableArray *Checks;
static unsigned CaptureStart;
static unsigned LogCalls;
static unsigned TimerCalls;
static dispatch_block_t DeferredTimer;
static NSException *BoundaryException;
// Scheme-task methods do not read their WKWebView argument; use an opaque test identity.
static WKWebView *OpaqueView;
static void Require(BOOL passed, NSString *name) {
  [Checks addObject:@{@"name":name,@"passed":@(passed)}];
  if (!passed) @throw [NSException exceptionWithName:@"HarnessFailure" reason:name userInfo:nil];
}
static void Capture(const char *format, ...) { LogCalls++; }
static void HarnessAfter(dispatch_time_t when, dispatch_queue_t queue, dispatch_block_t block) {
  TimerCalls++;
  DeferredTimer = [block copy];
}
// The harness catches only outside the production dispatch block; production has no catch.
static void HarnessDispatch(dispatch_queue_t queue, dispatch_block_t block) {
  dispatch_async(queue, ^{
    @try { block(); }
    @catch (NSException *exception) { @synchronized(Captured) { BoundaryException=exception; } }
  });
}
#undef os_log_with_type
#define os_log_with_type(log, type, format, ...) Capture(format, ##__VA_ARGS__)
#define dispatch_after HarnessAfter
#define dispatch_async HarnessDispatch
#import "source/RNCOneKeyWebEmbedAssets.m"
#undef dispatch_async
#undef dispatch_after

@interface GateBundle : NSBundle
@property NSDictionary *values;
@property NSString *identifier;
@end
@implementation GateBundle
- (id)objectForInfoDictionaryKey:(NSString *)key { return self.values[key]; }
- (NSString *)bundleIdentifier { return self.identifier; }
@end

@interface FakeTask : NSObject <WKURLSchemeTask>
@property (nonatomic,copy) NSURLRequest *request;
@property NSMutableArray *calls;
@property NSData *body;
@property NSURLResponse *response;
@property void (^responseHook)(void);
@property void (^dataHook)(void);
@property void (^finishHook)(void);
@end
@implementation FakeTask
- (instancetype)init {if((self=[super init]))_calls=[NSMutableArray new];return self;}
- (void)didReceiveResponse:(NSURLResponse *)response {[_calls addObject:@"response"];_response=response;if(_responseHook)_responseHook();}
- (void)didReceiveData:(NSData *)data {[_calls addObject:@"data"];_body=data;if(_dataHook)_dataHook();}
- (void)didFinish {[_calls addObject:@"finish"];if(_finishHook)_finishHook();}
- (void)didFailWithError:(NSError *)error {[_calls addObject:@"fail"];}
@end

static NSArray *Snapshot(void) {
  NSMutableArray *events = [NSMutableArray new];
  unsigned reserved = MIN(atomic_load(&OKTraceEventCount), 256);
  for (unsigned i=CaptureStart; i<reserved; i++) {
    if (!atomic_load_explicit(&OKTracePublished[i], memory_order_acquire)) continue;
    const OKTraceRecord *r = &OKTraceRecords[i];
    [events addObject:@{@"run":@ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_RUN_ID,
      @"manifest":@ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_MANIFEST,
      @"handler":@(r->handler),@"request":@(r->request),@"stage":@(OKTraceStageName(r->stage)),
      @"asset":r->asset==1?@"kaspa-loader":r->asset==2?@"kaspa-sdk":@"none",
      @"elapsed":@(MIN(r->elapsedNs/NSEC_PER_MSEC,90000)),@"bytes":@(MIN(r->bytes,64*1024*1024)),
      @"status":@(MAX(MIN(r->status,999),-999)),@"generation":@(MIN(r->generation,65535)),@"flags":@(r->flags&31)}];
  }
  return events;
}
static NSUInteger CountStage(NSString *stage) {
  NSUInteger count=0;for(NSDictionary *event in Snapshot())if([event[@"stage"] isEqual:stage])count++;return count;
}
static BOOL Wait(BOOL (^predicate)(void)) {
  NSTimeInterval start=NSProcessInfo.processInfo.systemUptime;
  while(!predicate() && NSProcessInfo.processInfo.systemUptime-start<10)CFRunLoopRunInMode(kCFRunLoopDefaultMode,0.005,YES);
  return predicate();
}
static void ResetCapture(void) { @synchronized(Captured) {[Captured removeAllObjects];BoundaryException=nil;CaptureStart=atomic_load(&OKTraceEventCount);} }
static FakeTask *Task(NSString *path) {
  FakeTask *task=[FakeTask new];NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:[NSURL URLWithString:[@"onekey-web-embed://bundle/" stringByAppendingString:path]]];
  [request setValue:@"SECRET_SENTINEL_DO_NOT_LOG" forHTTPHeaderField:@"X-Private-Fixture"];request.HTTPBody=[@"SECRET_SENTINEL_DO_NOT_LOG" dataUsingEncoding:NSUTF8StringEncoding];task.request=request;return task;
}
static RNCOneKeyWebEmbedAssets *Handler(void) {return [[RNCOneKeyWebEmbedAssets alloc]initWithBundle:NSBundle.mainBundle];}
static void GateTests(void) {
  Require(OKTraceIdentityMatches(NSBundle.mainBundle),@"exact Release bundle identity accepted");
  NSMutableDictionary *base=[NSBundle.mainBundle.infoDictionary mutableCopy];
  GateBundle *fake=[GateBundle new];fake.identifier=@"so.onekey.wallet";fake.values=base;
  NSArray *keys=@[@"runId",@"manifestDigest",@"version",@"buildNumber",@"bundleVersion"];
  for(NSString *key in keys){
    NSMutableDictionary *identity=[base[@"OneKeyMobileLockdownNativeTrace"] mutableCopy];[identity removeObjectForKey:key];
    NSMutableDictionary *values=[base mutableCopy];values[@"OneKeyMobileLockdownNativeTrace"]=identity;fake.values=values;
    Require(!OKTraceIdentityMatches(fake),[@"missing identity: " stringByAppendingString:key]);
    identity[key]=@"mismatch";Require(!OKTraceIdentityMatches(fake),[@"mismatched identity: " stringByAppendingString:key]);
  }
  for(NSString *key in @[@"CFBundleShortVersionString",@"CFBundleVersion",@"BUNDLE_VERSION"]){
    NSMutableDictionary *values=[base mutableCopy];values[key]=@"mismatch";fake.values=values;
    Require(!OKTraceIdentityMatches(fake),[@"native identity mismatch: " stringByAppendingString:key]);
  }
  fake.values=base;fake.identifier=@"unrelated.app";Require(!OKTraceIdentityMatches(fake),@"unrelated app cannot enable trace");
  Require(!OKTraceHex(@"00112233445566778899aabbccddeefG",32)&&!OKTraceHex((id)@42,32),@"strict lower hex and type check");
  Require(OKTraceMaxRequests==16,@"original request budget retained");
}
static NSString *Loader=@ONEKEY_TRACE_TEST_LOADER_PATH;
static NSString *SDK=@ONEKEY_TRACE_TEST_SDK_PATH;
static void ReaderTest(NSString *path,NSUInteger expectedLength) {
  ResetCapture();RNCOneKeyWebEmbedAssets *handler=Handler();FakeTask *task=Task(path);
  [handler webView:OpaqueView startURLSchemeTask:task];Require(Wait(^BOOL{return [task.calls containsObject:@"finish"];}),@"real reader completes");
  Require([task.calls isEqual:@[@"response",@"data",@"finish"]],@"original callback order and count");
  NSData *expected=[NSData dataWithContentsOfURL:[NSBundle.mainBundle.resourceURL URLByAppendingPathComponent:[@"web-embed/" stringByAppendingString:path]]];
  Require(task.body.length==expectedLength&&[task.body isEqual:expected],@"real packaged bytes delivered exactly");
  Require([(NSHTTPURLResponse *)task.response statusCode]==200,@"original successful response");
  NSMutableArray *stages=[NSMutableArray new];for(NSDictionary *event in Snapshot())if([event[@"request"] unsignedIntegerValue]==1)[stages addObject:event[@"stage"]];
  Require([stages isEqual:@[@"request-start",@"read-begin",@"read-complete",@"delivery-enter",@"response-enter",@"response-return",@"data-enter",@"data-return",@"finish-enter",@"finish-return"]],@"complete request stage sequence");
  for(NSDictionary *event in Snapshot())if([event[@"stage"] isEqual:@"read-begin"]||[event[@"stage"] isEqual:@"read-complete"])Require(([event[@"flags"] unsignedIntValue]&1)==0,@"real read runs off main");
  NSString *serialized=[[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:Snapshot() options:0 error:nil]encoding:NSUTF8StringEncoding];
  Require(![serialized containsString:@"SECRET_SENTINEL"]&&![serialized containsString:@"onekey-web-embed://"]&&! [serialized containsString:path],@"trace contains no arbitrary URI header or body");
}
static void StopTests(void) {
  for(NSString *mode in @[@"before-stop",@"before-invalidate",@"response-stop",@"data-invalidate",@"replace-token"]){
    ResetCapture();RNCOneKeyWebEmbedAssets *handler=Handler();FakeTask *task=Task(Loader);
    __weak FakeTask *weakTask=task;
    if([mode isEqual:@"response-stop"])task.responseHook=^{FakeTask *current=weakTask;if(current)[handler webView:OpaqueView stopURLSchemeTask:current];};
    if([mode isEqual:@"data-invalidate"])task.dataHook=^{[handler invalidate];};
    [handler webView:OpaqueView startURLSchemeTask:task];
    if([mode isEqual:@"before-stop"])[handler webView:OpaqueView stopURLSchemeTask:task];
    if([mode isEqual:@"before-invalidate"])[handler invalidate];
    if([mode isEqual:@"replace-token"])[handler webView:OpaqueView startURLSchemeTask:task];
    Require(Wait(^BOOL{return CountStage(@"delivery-discarded")>=1&&(![mode isEqual:@"replace-token"]||[task.calls containsObject:@"finish"]);}),[@"discard observed: " stringByAppendingString:mode]);
    NSArray *expected=[mode isEqual:@"response-stop"]?@[@"response"]:[mode isEqual:@"data-invalidate"]?@[@"response",@"data"]:[mode isEqual:@"replace-token"]?@[@"response",@"data",@"finish"]:@[];
    Require([task.calls isEqual:expected],[@"original suppression preserved: " stringByAppendingString:mode]);
    task.responseHook=nil;task.dataHook=nil;
  }
}
static void ThrowTests(void) {
  for(NSString *point in @[@"response",@"data",@"finish"]){
    ResetCapture();RNCOneKeyWebEmbedAssets *handler=Handler();FakeTask *task=Task(Loader);
    NSException *expected=[NSException exceptionWithName:@"FixedFixtureException" reason:@"SECRET_SENTINEL_DO_NOT_LOG" userInfo:nil];
    void (^fail)(void)=^{@throw expected;};
    if([point isEqual:@"response"])task.responseHook=fail;
    else if([point isEqual:@"data"])task.dataHook=fail;
    else task.finishHook=fail;
    [handler webView:OpaqueView startURLSchemeTask:task];Require(Wait(^BOOL{return BoundaryException!=nil;}),@"throw reached only harness boundary");
    Require(BoundaryException==expected,@"original exception identity preserved");
    Require(CountStage([point stringByAppendingString:@"-enter"])==1&&CountStage([point stringByAppendingString:@"-return"])==0,@"throw is not swallowed retried or recorded as return");
    NSArray *expectedCalls=[point isEqual:@"response"]?@[@"response"]:[point isEqual:@"data"]?@[@"response",@"data"]:@[@"response",@"data",@"finish"];
    Require([task.calls isEqual:expectedCalls],@"no callback after throwing boundary");
    task.responseHook=nil;task.dataHook=nil;task.finishHook=nil;
  }
}
static void NegativeAssets(void) {
  Require(OKTraceAsset(@[@"static",@"js",@"693.a.chunk.js\n"])==0,@"ICU terminal newline cannot classify as an exact SDK filename");
  Require(OKTraceAsset(@[@"static",@"js",@"871.a.chunk.js\r\n"])==0,@"ICU terminal CRLF cannot classify as an exact loader filename");
  for(NSString *url in @[@"https://bundle/static/js/693.a.chunk.js",@"onekey-web-embed://other/static/js/693.a.chunk.js",@"onekey-web-embed://bundle/static/js/693.a.chunk.js?secret",@"onekey-web-embed://bundle/static/js/693.a.chunk.js#secret",@"onekey-web-embed://bundle/static%2fjs/693.a.chunk.js",@"onekey-web-embed://bundle/static/js/694.a.chunk.js",@"onekey-web-embed://bundle/static/js/693.BAD.chunk.js"]){
    NSURLRequest *request=[NSURLRequest requestWithURL:[NSURL URLWithString:url]];
    Require(OKTraceAsset([RNCOneKeyWebEmbedAssets pathComponentsForRequest:request])==0,@"unrelated or malformed asset cannot be traced");
  }
}
static void DisabledIdentityTest(void) {
  Require(!OKTraceIdentityMatches(NSBundle.mainBundle),@"mismatched actual native bundle rejected");
  RNCOneKeyWebEmbedAssets *handler=Handler();
  [handler traceRequest:RNCOneKeyTraceReadBegin context:@{@"request":@1,@"asset":@2,@"generation":@0} bytes:0 status:0 flags:0];
  Require(Snapshot().count==0,@"direct emitter entry also requires exact runtime identity");
  FakeTask *task=Task(SDK);[handler webView:OpaqueView startURLSchemeTask:task];
  Require(Wait(^BOOL{return [task.calls containsObject:@"finish"];}),@"runtime trace gate cannot block resource delivery");
  Require(task.body.length==ONEKEY_TRACE_TEST_SDK_BYTES&&[task.calls isEqual:@[@"response",@"data",@"finish"]]&&Snapshot().count==0,@"mismatched bundle completes original callbacks with no native trace");
}
static void BudgetTests(void) {
  RNCOneKeyWebEmbedAssets *handler=Handler();NSMutableArray<FakeTask *> *tasks=[NSMutableArray new];
  for(NSUInteger i=0;i<20;i++){FakeTask *task=Task(Loader);[tasks addObject:task];[handler webView:OpaqueView startURLSchemeTask:task];}
  Require(Wait(^BOOL{for(FakeTask *task in tasks)if(![task.calls containsObject:@"finish"])return NO;return YES;}),@"request budget cannot stop actual callbacks");
  Require(CountStage(@"request-start")==16&&CountStage(@"request-budget-exhausted")==1,@"bounded traced requests with one explicit exhaustion marker");
  for(FakeTask *task in tasks)Require([task.calls isEqual:@[@"response",@"data",@"finish"]],@"all callbacks retain order after request quota");
  for(NSUInteger i=0;i<500;i++)[handler traceLifecycle:RNCOneKeyTraceNavigationFinish generation:0 committed:YES];
  Require(Snapshot().count==256&&CountStage(@"event-budget-exhausted")==1,@"event budget saturates with one explicit marker");
  RNCOneKeyWebEmbedAssets *other=Handler();FakeTask *task=Task(SDK);[other webView:OpaqueView startURLSchemeTask:task];
  Require(Wait(^BOOL{return [task.calls containsObject:@"finish"];}),@"global trace exhaustion leaves actual SDK delivery intact");
  Require(task.body.length==ONEKEY_TRACE_TEST_SDK_BYTES&&[task.calls isEqual:@[@"response",@"data",@"finish"]]&&Snapshot().count==256,@"full SDK callbacks complete without growing trace budget");
}
int main(int argc,const char **argv){@autoreleasepool{
  Captured=[NSMutableArray new];Checks=[NSMutableArray new];OpaqueView=(WKWebView *)[NSObject new];
  @try{
    if(argc>2&&strcmp(argv[2],"disabled-identity")==0)DisabledIdentityTest();
    else if(argc>2&&strcmp(argv[2],"budget")==0)BudgetTests();
    else {GateTests();NegativeAssets();ReaderTest(Loader,ONEKEY_TRACE_TEST_LOADER_BYTES);ReaderTest(SDK,ONEKEY_TRACE_TEST_SDK_BYTES);StopTests();ThrowTests();}
    Require(LogCalls==0,@"zero system-log submissions before deferred snapshot");
  if(DeferredTimer){
    Require(TimerCalls==1,@"one timer per native process");
    dispatch_sync(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),DeferredTimer);
    Require(atomic_load(&OKTraceFlushed),@"deferred snapshot ran");
    Require(LogCalls>0,@"published fixed records emitted after snapshot");
    unsigned before=LogCalls;OKTraceFlush();Require(LogCalls==before,@"second flush is a no-op");
  }else Require(TimerCalls==0,@"invalid native identity schedules no timer");
  NSData *report=[NSJSONSerialization dataWithJSONObject:@{@"passed":@YES,@"checks":Checks,@"checkCount":@(Checks.count),@"scope":@"Real production helper/read queue/main delivery with fake WK tasks. os_log sink and outer dispatch exception boundary belong to this harness only. No simulator or actual OneKey app."}options:NSJSONWritingPrettyPrinted error:nil];
    [report writeToFile:@(argv[1])atomically:YES];printf("PASS checks=%lu\n",(unsigned long)Checks.count);return 0;
  }@catch(NSException *error){
    NSData *report=[NSJSONSerialization dataWithJSONObject:@{@"passed":@NO,@"checks":Checks}options:NSJSONWritingPrettyPrinted error:nil];[report writeToFile:@(argv[1])atomically:YES];fprintf(stderr,"FAIL: native harness assertion or exception\n");return 1;
  }
}}
