// The runner extracts these method bodies byte-for-byte from the installed RNCWebViewImpl.
// It does not replace the complete React Native view/application integration check.
#import <WebKit/WebKit.h>
#import "RNCOneKeyWebEmbedAssets.h"
@interface StateFixture : NSObject {
@public
  BOOL _oneKeyWebEmbedAssets, _oneKeyWebEmbedModeLocked, _oneKeyWebEmbedBlocked, _oneKeyWebEmbedCommitted;
  BOOL _allowFileAccessFromFileURLs, _allowUniversalAccessFromFileURLs;
  NSUInteger _oneKeyWebEmbedGeneration, _visits;
  NSString *_allowingReadAccessToURL;
  NSDictionary *_source;
  WKWebView *_webView;
  WKNavigation *_oneKeyWebEmbedNavigation;
  RNCOneKeyWebEmbedAssets *_oneKeyWebEmbedHandler;
  void (^_onLoadingError)(NSDictionary *);
}
@property (nonatomic) BOOL oneKeyWebEmbedAssets;
@end
@implementation StateFixture
- (void)visitSource { _visits++; }
#include "ProductionStateMethods.inc"
@end
static void ApplyProductionFabricProperty(StateFixture *_view, BOOL requested) {
  struct { BOOL oneKeyWebEmbedAssets; } newViewProps = { requested };
#include "ProductionFabricProp.inc"
}
NSArray *RunProductionStateChecks(void) {
  NSMutableArray *results = [NSMutableArray new];
  void (^check)(BOOL,NSString *) = ^(BOOL value, NSString *name) { [results addObject:@{@"name":name,@"passed":@(value)}]; };
  NSDictionary *source = @{@"uri":RNCOneKeyWebEmbedAssets.documentURL.absoluteString};
  StateFixture *ordinary = [StateFixture new]; ordinary->_oneKeyWebEmbedModeLocked = YES;
  [ordinary setSource:@{@"html":@"Ordinary view"}];
  check(ordinary->_source[@"html"] != nil && !ordinary->_oneKeyWebEmbedBlocked, @"ordinary-html-setter-unchanged");
  ApplyProductionFabricProperty(ordinary, YES); ApplyProductionFabricProperty(ordinary, NO);
  check(ordinary->_oneKeyWebEmbedAssets && ordinary->_oneKeyWebEmbedBlocked, @"live-false-true-false-remains-blocked");
  [ordinary resetOneKeyWebEmbedAfterDestroy];
  // Fabric's previous and next props are both false after the rejected toggle.
  ApplyProductionFabricProperty(ordinary, NO);
  check(!ordinary->_oneKeyWebEmbedAssets && !ordinary->_oneKeyWebEmbedBlocked, @"fabric-equal-false-props-reconcile-native-after-recycle");
  StateFixture *protected = [StateFixture new]; [protected setOneKeyWebEmbedAssets:YES]; [protected setSource:source];
  protected->_oneKeyWebEmbedModeLocked = YES; protected->_oneKeyWebEmbedCommitted = YES;
  NSUInteger oldGeneration = protected->_oneKeyWebEmbedGeneration;
  [protected setOneKeyWebEmbedAssets:NO];
  check(protected->_oneKeyWebEmbedAssets && protected->_oneKeyWebEmbedBlocked && !protected->_oneKeyWebEmbedCommitted && oldGeneration != protected->_oneKeyWebEmbedGeneration, @"live-protected-disable-revokes-commit-and-old-callback-generation");
  [protected resetOneKeyWebEmbedAfterDestroy];
  check(!protected->_oneKeyWebEmbedModeLocked && !protected->_oneKeyWebEmbedBlocked && !protected->_oneKeyWebEmbedCommitted && protected->_oneKeyWebEmbedHandler == nil && protected->_oneKeyWebEmbedNavigation == nil, @"fabric-teardown-clears-authority-before-reuse");
  [protected setOneKeyWebEmbedAssets:NO]; [protected setSource:@{@"html":@"Recycled ordinary view"}];
  check(!protected->_oneKeyWebEmbedAssets && !protected->_oneKeyWebEmbedBlocked, @"recycled-view-can-be-ordinary-only-after-destroy");
  StateFixture *invalid = [StateFixture new]; [invalid setOneKeyWebEmbedAssets:YES]; [invalid setSource:@{@"uri":source[@"uri"],@"html":@"Spoof"}];
  check(invalid->_oneKeyWebEmbedBlocked && !invalid->_oneKeyWebEmbedCommitted, @"html-plus-safe-uri-fails-closed");
  [invalid setSource:source]; check(invalid->_oneKeyWebEmbedBlocked, @"valid-source-does-not-recover-blocked-view");
  for (NSString *setting in @[@"file",@"universal",@"read-root"]) {
    StateFixture *view = [StateFixture new]; [view setOneKeyWebEmbedAssets:YES];
    if ([setting isEqual:@"file"]) [view setAllowFileAccessFromFileURLs:YES];
    else if ([setting isEqual:@"universal"]) [view setAllowUniversalAccessFromFileURLs:YES];
    else [view setAllowingReadAccessToURL:@"file:///"];
    check(view->_oneKeyWebEmbedBlocked && !view->_allowFileAccessFromFileURLs && !view->_allowUniversalAccessFromFileURLs && view->_allowingReadAccessToURL == nil, [@"reject-native-privilege-change-" stringByAppendingString:setting]);
  }
  return results;
}
