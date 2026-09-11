// Tests the shipped scheme handler and native message guard in an isolated WKWebView.
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import "RNCOneKeyWebEmbedAssets.h"

@interface ProbeTask : NSObject <WKURLSchemeTask>
@property (nonatomic, copy) NSURLRequest *request;
@property id<WKURLSchemeTask> destination;
@property BOOL tamper;
@property NSMutableArray *callbacks;
@property void (^finished)(ProbeTask *);
@property void (^responded)(ProbeTask *);
@property NSInteger status;
@property NSData *body;
@end
@implementation ProbeTask
- (instancetype)init { if ((self = [super init])) _callbacks = [NSMutableArray new]; return self; }
- (void)didReceiveResponse:(NSURLResponse *)response {
  [_callbacks addObject:@"response"];
  _status = [(NSHTTPURLResponse *)response statusCode];
  NSAssert(![(NSHTTPURLResponse *)response allHeaderFields][@"Access-Control-Allow-Origin"], @"CORS must not be relaxed");
  [_destination didReceiveResponse:response];
  if (_responded) _responded(self);
}
- (void)didReceiveData:(NSData *)data {
  [_callbacks addObject:@"data"];
  _body = data;
  if (_tamper && [_request.URL.lastPathComponent hasPrefix:@"lavamoat-runtime."]) {
    NSMutableData *changed = [[@"globalThis.__schemeTamperMarker=true;" dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];
    [changed appendData:data];
    [_destination didReceiveData:changed];
  } else { [_destination didReceiveData:data]; }
}
- (void)didFinish { [_callbacks addObject:@"finish"]; [_destination didFinish]; if (_finished) _finished(self); }
- (void)didFailWithError:(NSError *)error { [_callbacks addObject:@"error"]; [_destination didFailWithError:error]; if (_finished) _finished(self); }
@end

@interface ProbeHandler : NSObject <WKURLSchemeHandler>
@property RNCOneKeyWebEmbedAssets *production;
@property BOOL tamper;
@property NSMapTable *tasks;
@property NSMutableArray *completedScripts;
@end
@implementation ProbeHandler
- (instancetype)init {
  if ((self = [super init])) { _production = [[RNCOneKeyWebEmbedAssets alloc] initWithBundle:NSBundle.mainBundle]; _tasks = [NSMapTable strongToStrongObjectsMapTable]; _completedScripts = [NSMutableArray new]; }
  return self;
}
- (void)webView:(WKWebView *)view startURLSchemeTask:(id<WKURLSchemeTask>)task {
  ProbeTask *forward = [ProbeTask new]; forward.request = task.request; forward.destination = task; forward.tamper = _tamper;
  __weak ProbeHandler *weakSelf = self;
  forward.finished = ^(ProbeTask *completed) { if (completed.status == 200 && [completed.request.URL.pathExtension isEqual:@"js"]) [weakSelf.completedScripts addObject:completed.request.URL.lastPathComponent]; };
  [_tasks setObject:forward forKey:task];
  [_production webView:view startURLSchemeTask:forward];
}
- (void)webView:(WKWebView *)view stopURLSchemeTask:(id<WKURLSchemeTask>)task {
  ProbeTask *forward = [_tasks objectForKey:task]; if (forward) [_production webView:view stopURLSchemeTask:forward]; [_tasks removeObjectForKey:task];
}
@end

NSArray *RunProductionStateChecks(void);

@interface Probe : UIResponder <UIApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property (nonatomic, strong) UIWindow *window;
@property WKWebView *view;
@property ProbeHandler *handler;
@property NSMutableArray *results;
@property NSMutableArray *events;
@property NSMutableArray *checks;
@property NSUInteger mode;
@property BOOL committed;
@end
@implementation Probe
- (void)check:(BOOL)passed name:(NSString *)name { [_checks addObject:@{@"name": name, @"passed": @(passed)}]; }
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
  _results = [NSMutableArray new]; _checks = [RunProductionStateChecks() mutableCopy];
  _window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds]; _window.rootViewController = [UIViewController new]; [_window makeKeyAndVisible];
  [self staticChecks]; [self taskChecks]; [self startMode]; return YES;
}
- (void)staticChecks {
  NSDictionary *source = @{@"uri": RNCOneKeyWebEmbedAssets.documentURL.absoluteString};
  [self check:[RNCOneKeyWebEmbedAssets isAllowedSource:source] name:@"exact-source"];
  [self check:[RNCOneKeyWebEmbedAssets isDocumentURL:[NSURL URLWithString:@"onekey-web-embed://bundle/index.html#/webembed/api"] allowFragment:YES] name:@"document-route-fragment"];
  for (NSString *uri in @[@"onekey-web-embed://%62undle/index.html", @"onekey-web-embed://b%75ndle/index.html", @"onekey-web-embed://bundle:/index.html", @"file:///index.html", @"content://bundle/index.html", @"https://bundle/index.html", @"onekey-web-embed://other/index.html", @"onekey-web-embed://bundle/index.html?x", @"onekey-web-embed://bundle/index.html#x", @"onekey-web-embed://user@bundle/index.html", @"onekey-web-embed://bundle:123/index.html", @"onekey-web-embed://bundle/%69ndex.html", @"onekey-web-embed://bundle/a/../index.html"]) {
    [self check:![RNCOneKeyWebEmbedAssets isAllowedSource:@{@"uri":uri}] name:[@"reject-source-" stringByAppendingString:uri]];
  }
  for (NSDictionary *extra in @[@{@"html":@"<script></script>"}, @{@"baseUrl":RNCOneKeyWebEmbedAssets.documentURL.absoluteString}, @{@"method":@"POST"}, @{@"headers":@{}}, @{@"body":@""}]) {
    NSMutableDictionary *invalid = [source mutableCopy]; [invalid addEntriesFromDictionary:extra];
    [self check:![RNCOneKeyWebEmbedAssets isAllowedSource:invalid] name:[@"reject-source-key-" stringByAppendingString:extra.allKeys.firstObject]];
  }
}
- (void)taskChecks {
  WKWebView *taskView = [WKWebView new];
  RNCOneKeyWebEmbedAssets *handler = [[RNCOneKeyWebEmbedAssets alloc] initWithBundle:NSBundle.mainBundle];
  for (NSString *path in @[@"/index.html?x", @"/index.html#x", @"/%2e%2e/index.html", @"//index.html", @"/static/../index.html", @"/not-present.js"]) {
    ProbeTask *task = [ProbeTask new]; task.request = [NSURLRequest requestWithURL:[NSURL URLWithString:[@"onekey-web-embed://bundle" stringByAppendingString:path]]];
    task.finished = ^(ProbeTask *done) { [self check:done.status == ([path isEqual:@"/not-present.js"] ? 404 : 403) && done.body.length == 0 name:[@"reject-asset-" stringByAppendingString:path]]; };
    [handler webView:taskView startURLSchemeTask:task];
  }
  for (NSString *uri in @[@"onekey-web-embed://%62undle/index.html", @"onekey-web-embed://b%75ndle/index.html", @"onekey-web-embed://bundle:/index.html"]) {
    ProbeTask *task = [ProbeTask new]; task.request = [NSURLRequest requestWithURL:[NSURL URLWithString:uri]];
    task.finished = ^(ProbeTask *done) { [self check:done.status == 403 && done.body.length == 0 name:[@"reject-raw-asset-authority-" stringByAppendingString:uri]]; };
    [handler webView:taskView startURLSchemeTask:task];
  }
  ProbeTask *post = [ProbeTask new]; NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:RNCOneKeyWebEmbedAssets.documentURL]; request.HTTPMethod = @"POST"; post.request = request;
  post.finished = ^(ProbeTask *done) { [self check:done.status == 403 name:@"reject-asset-post"]; }; [handler webView:taskView startURLSchemeTask:post];
  ProbeTask *stopped = [ProbeTask new]; stopped.request = [NSURLRequest requestWithURL:RNCOneKeyWebEmbedAssets.documentURL];
  [handler webView:taskView startURLSchemeTask:stopped]; [handler webView:taskView stopURLSchemeTask:stopped];
  RNCOneKeyWebEmbedAssets *invalidated = [[RNCOneKeyWebEmbedAssets alloc] initWithBundle:NSBundle.mainBundle];
  ProbeTask *cancelled = [ProbeTask new]; cancelled.request = stopped.request; [invalidated webView:taskView startURLSchemeTask:cancelled]; [invalidated invalidate];
  ProbeTask *stopInResponse = [ProbeTask new]; stopInResponse.request = stopped.request;
  stopInResponse.responded = ^(ProbeTask *task) { [handler webView:taskView stopURLSchemeTask:task]; };
  [handler webView:taskView startURLSchemeTask:stopInResponse];
  // A native-only fixture Bundle exercises both leaf and intermediate symlink rejection.
  NSString *bundlePath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"Symlinks.bundle"];
  NSString *root = [bundlePath stringByAppendingPathComponent:@"web-embed"];
  NSFileManager *files = NSFileManager.defaultManager;
  [files createDirectoryAtPath:root withIntermediateDirectories:YES attributes:nil error:nil];
  [@{@"CFBundleIdentifier":@"so.onekey.lavamoat.symlinkfixture",@"CFBundlePackageType":@"BNDL"} writeToFile:[bundlePath stringByAppendingPathComponent:@"Info.plist"] atomically:YES];
  NSString *outside = [bundlePath stringByAppendingPathComponent:@"outside.txt"];
  [@"public-fixture-only" writeToFile:outside atomically:YES encoding:NSUTF8StringEncoding error:nil];
  [files createSymbolicLinkAtPath:[root stringByAppendingPathComponent:@"escape.txt"] withDestinationPath:outside error:nil];
  [files createSymbolicLinkAtPath:[root stringByAppendingPathComponent:@"directory"] withDestinationPath:bundlePath error:nil];
  RNCOneKeyWebEmbedAssets *symlinks = [[RNCOneKeyWebEmbedAssets alloc] initWithBundle:[NSBundle bundleWithPath:bundlePath]];
  for (NSString *name in @[@"escape.txt", @"directory/outside.txt"]) {
    ProbeTask *task = [ProbeTask new]; task.request = [NSURLRequest requestWithURL:[NSURL URLWithString:[@"onekey-web-embed://bundle/" stringByAppendingString:name]]];
    task.finished = ^(ProbeTask *done) { [self check:done.status == 404 && done.body.length == 0 name:[@"reject-symlink-" stringByAppendingString:name]]; };
    [symlinks webView:taskView startURLSchemeTask:task];
  }
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self check:[stopInResponse.callbacks isEqual:@[@"response"]] name:@"stop-from-response-suppresses-data-and-finish"];
    [self check:stopped.callbacks.count == 0 name:@"stop-suppresses-all-callbacks"];
    [self check:cancelled.callbacks.count == 0 name:@"invalidate-suppresses-all-callbacks"];
  });
}
- (void)startMode {
  _committed = NO; _events = [NSMutableArray new];
  WKWebViewConfiguration *configuration = [WKWebViewConfiguration new]; configuration.websiteDataStore = WKWebsiteDataStore.nonPersistentDataStore;
  _handler = [ProbeHandler new]; _handler.tamper = _mode == 1;
  if (_mode != 3) [configuration setURLSchemeHandler:_handler forURLScheme:@"onekey-web-embed"];
  [configuration.userContentController addScriptMessageHandler:self name:@"probe"];
  NSString *capture = @"(() => { const post = (kind, data) => webkit.messageHandlers.probe.postMessage({kind,data}); addEventListener('error',e=>post('error',{tag:e.target.tagName||'',message:e.message||''}),true); addEventListener('load',e=>{if(e.target.tagName==='SCRIPT')post('script-load',e.target.src)},true); addEventListener('unhandledrejection',e=>post('rejection',String(e.reason))); setTimeout(()=>post('frame',{top:self===top,origin:location.origin,url:location.href}),1200); if(self===top)setTimeout(()=>{post('main',{});location.hash='/webembed/api-test-fixture';post('fragment',{}); const child=document.createElement('iframe');document.body.appendChild(child);child.contentWindow.eval(\"webkit.messageHandlers.probe.postMessage({kind:'iframe-attempt',data:{bodyUrl:'onekey-web-embed://bundle/index.html'}})\");const opaque=document.createElement('iframe');opaque.sandbox='allow-scripts';opaque.srcdoc=\"<script>webkit.messageHandlers.probe.postMessage({kind:'opaque-attempt',data:{}})<\\/script>\";document.body.appendChild(opaque);},2000); })();";
  [configuration.userContentController addUserScript:[[WKUserScript alloc] initWithSource:capture injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO]];
  _view = [[WKWebView alloc] initWithFrame:_window.rootViewController.view.bounds configuration:configuration]; _view.navigationDelegate = self; [_window.rootViewController.view addSubview:_view];
  // Block external fixture traffic without changing app HTML, CSP, or file preferences.
  NSString *rules = @"[{\"trigger\":{\"url-filter\":\"^https?://\"},\"action\":{\"type\":\"block\"}},{\"trigger\":{\"url-filter\":\"^wss?://\"},\"action\":{\"type\":\"block\"}}]";
  [WKContentRuleListStore.defaultStore compileContentRuleListForIdentifier:@"OneKeyNativeSchemeNoNetwork" encodedContentRuleList:rules completionHandler:^(WKContentRuleList *rule, NSError *error) {
    [self check:rule != nil name:@"fixture-network-block-installed"]; if (rule) [configuration.userContentController addContentRuleList:rule];
    if (self->_mode == 3) [self->_view loadHTMLString:@"<html><body>Ordinary WebView</body></html>" baseURL:[NSURL URLWithString:@"https://ordinary.invalid/"]];
    else [self->_view loadRequest:[NSURLRequest requestWithURL:RNCOneKeyWebEmbedAssets.documentURL]];
    if (self->_mode == 4) {
      NSArray *destinations = @[@"https://navigation.invalid/", @"file:///index.html", @"content://bundle/index.html", @"onekey-web-embed://other/index.html", @"onekey-web-embed://bundle/index.html?query"];
      [destinations enumerateObjectsUsingBlock:^(NSString *url,NSUInteger index,BOOL *stop) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (3 * NSEC_PER_SEC) + index * (NSEC_PER_SEC / 2)), dispatch_get_main_queue(), ^{
          // WebKit blocks JS-to-file navigation before the delegate; also exercise its native entry.
          if ([url hasPrefix:@"file:"]) [self->_view loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:url]]];
          else [self->_view evaluateJavaScript:[NSString stringWithFormat:@"location.href='%@'",url] completionHandler:nil];
        });
      }];
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 7 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{ [self finishMode]; });
  }];
}
- (void)webView:(WKWebView *)view decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decision {
  if (_mode != 4) { decision(WKNavigationActionPolicyAllow); return; }
  BOOL allowed = [RNCOneKeyWebEmbedAssets isAllowedNavigationAction:action source:@{@"uri":RNCOneKeyWebEmbedAssets.documentURL.absoluteString}];
  [_events addObject:@{@"kind":@"navigation",@"allowed":@(allowed),@"mainFrame":@(action.targetFrame.isMainFrame),@"url":action.request.URL.absoluteString ?: @""}];
  decision(allowed ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}
- (void)webView:(WKWebView *)view didCommitNavigation:(WKNavigation *)navigation { _committed = YES; }
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
  NSDictionary *source = @{@"uri":RNCOneKeyWebEmbedAssets.documentURL.absoluteString};
  BOOL allowed = [RNCOneKeyWebEmbedAssets isAllowedMessage:message webView:_view source:source navigationCommitted:_committed];
  NSDictionary *body = [message.body isKindOfClass:NSDictionary.class] ? message.body : @{};
  [_events addObject:@{@"kind":body[@"kind"] ?: @"unknown", @"allowed":@(allowed), @"mainFrame":@(message.frameInfo.isMainFrame), @"origin":[NSString stringWithFormat:@"%@://%@:%ld", message.frameInfo.securityOrigin.protocol,message.frameInfo.securityOrigin.host,(long)message.frameInfo.securityOrigin.port], @"frameURL":message.frameInfo.request.URL.absoluteString ?: @"", @"data":body[@"data"] ?: @{} }];
  if (allowed) {
    [self check:![RNCOneKeyWebEmbedAssets isAllowedMessage:message webView:_view source:source navigationCommitted:NO] name:@"reject-uncommitted-message"];
    [self check:![RNCOneKeyWebEmbedAssets isAllowedMessage:message webView:_view source:@{@"html":@"",@"baseUrl":source[@"uri"]} navigationCommitted:YES] name:@"reject-html-origin-spoof"];
  }
}
- (void)finishMode {
  [_view evaluateJavaScript:@"JSON.stringify({harden:typeof harden,frozen:Object.isFrozen(Object.prototype),marker:globalThis.__schemeTamperMarker===true,origin:location.origin,url:location.href,secure:isSecureContext,rootChildCount:document.querySelector('#root')?.childElementCount||0,scripts:[...document.scripts].filter(s=>s.src).map(s=>({src:s.src,sri:s.integrity,crossOrigin:s.crossOrigin}))})" completionHandler:^(id value, NSError *error) {
    NSDictionary *state = [value isKindOfClass:NSString.class] ? [NSJSONSerialization JSONObjectWithData:[value dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : @{};
    NSArray *events = [self->_events copy]; BOOL protected = self->_mode == 0 || self->_mode == 2 || self->_mode == 4;
    [self check:[state[@"frozen"] boolValue] == protected name:@"expected-lockdown-state"];
    [self check:![state[@"marker"] boolValue] name:@"tamper-marker-never-executed"];
    NSUInteger acceptedMain = 0, acceptedFragment = 0, deniedFrames = 0, runtimeErrors = 0;
    NSMutableSet *deniedNavigations = [NSMutableSet new];
    for (NSDictionary *event in events) {
      if ([event[@"kind"] isEqual:@"navigation"] && ![event[@"allowed"] boolValue]) [deniedNavigations addObject:event[@"url"]];
      if ([event[@"kind"] isEqual:@"fragment"] && [event[@"allowed"] boolValue]) acceptedFragment++;
      if ([event[@"kind"] isEqual:@"main"] && [event[@"allowed"] boolValue]) acceptedMain++;
      if (([event[@"kind"] isEqual:@"iframe-attempt"] || [event[@"kind"] isEqual:@"opaque-attempt"]) && ![event[@"allowed"] boolValue] && ![event[@"mainFrame"] boolValue]) deniedFrames++;
      if ([event[@"kind"] isEqual:@"error"] && [event[@"data"][@"tag"] isEqual:@"SCRIPT"]) runtimeErrors++;
    }
    if (self->_mode != 4) [self check:deniedFrames == 2 name:@"actual-same-origin-and-opaque-iframe-messages-denied"];
    if (self->_mode == 4) {
      for (NSString *url in @[@"https://navigation.invalid/", @"file:///index.html", @"content://bundle/index.html", @"onekey-web-embed://other/index.html", @"onekey-web-embed://bundle/index.html?query"]) [self check:[deniedNavigations containsObject:url] name:[@"actual-native-navigation-denied-" stringByAppendingString:url]];
      [self check:[state[@"url"] isEqual:@"onekey-web-embed://bundle/index.html#/webembed/api-test-fixture"] name:@"denied-navigation-retains-trusted-document"];
    }
    [self check:self->_mode == 3 ? acceptedFragment == 0 : acceptedFragment == 1 name:@"document-fragment-route-keeps-native-main-frame-identity"];
    [self check:self->_mode == 3 ? acceptedMain == 0 : acceptedMain == 1 name:@"native-main-frame-authority"];
    if (protected) {
      NSUInteger loaded = 0;
      for (NSDictionary *script in state[@"scripts"]) if ([self->_handler.completedScripts containsObject:[NSURL URLWithString:script[@"src"]].lastPathComponent]) loaded++;
      [self check:loaded == 3 && [state[@"scripts"] count] == 3 && runtimeErrors == 0 && [state[@"rootChildCount"] integerValue] > 0 name:@"all-three-original-sri-scripts-served-and-main-rendered"];
      [self check:[state[@"secure"] boolValue] name:@"custom-scheme-secure-context"];
      for (NSDictionary *script in state[@"scripts"]) [self check:[script[@"sri"] hasPrefix:@"sha384-"] && [script[@"crossOrigin"] isEqual:@"anonymous"] name:@"original-sri-and-crossorigin-preserved"];
    }
    if (self->_mode == 1) [self check:runtimeErrors > 0 && [state[@"harden"] isEqual:@"undefined"] name:@"actual-sri-rejects-mutated-runtime-response"];
    [self->_results addObject:@{@"mode":@[@"control-before",@"tampered-runtime",@"control-after",@"ordinary-html",@"native-navigation"][self->_mode], @"state":state ?: @{}, @"events":events, @"evaluationError":error.localizedDescription ?: @""}];
    [self->_view takeSnapshotWithConfiguration:nil completionHandler:^(UIImage *image,NSError *snapshotError) {
      NSString *documents = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory,NSUserDomainMask,YES).firstObject;
      [UIImagePNGRepresentation(image) writeToFile:[documents stringByAppendingPathComponent:[NSString stringWithFormat:@"mode-%lu.png",(unsigned long)self->_mode]] atomically:YES];
      [self->_view.configuration.userContentController removeScriptMessageHandlerForName:@"probe"]; [self->_handler.production invalidate]; [self->_view stopLoading]; [self->_view removeFromSuperview]; self->_view = nil; self->_mode++;
      if (self->_mode < 5) [self startMode]; else {
        BOOL passed = YES; for (NSDictionary *check in self->_checks) if (![check[@"passed"] boolValue]) passed = NO;
        NSData *json = [NSJSONSerialization dataWithJSONObject:@{@"passed":@(passed),@"checks":self->_checks,@"results":self->_results,@"scope":@"Actual production helper and guard, not the complete RNCWebView or OneKey application."} options:NSJSONWritingPrettyPrinted|NSJSONWritingSortedKeys error:nil];
        [json writeToFile:[documents stringByAppendingPathComponent:@"report.json"] atomically:YES]; NSLog(@"ONEKEY_SCHEME_TEST_COMPLETE passed=%d",passed);
      }
    }];
  }];
}
@end
int main(int argc, char *argv[]) { @autoreleasepool { return UIApplicationMain(argc,argv,nil,NSStringFromClass(Probe.class)); } }
