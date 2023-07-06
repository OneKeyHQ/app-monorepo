//
//  PagingViewManager.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/18.
//

#import "PagingViewManager.h"
#import "PagingView.h"
#import <React/RCTUIManager.h>

@implementation PagingViewManager
RCT_EXPORT_MODULE(NestedTabView)
RCT_EXPORT_VIEW_PROPERTY(onChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(headerHeight, CGFloat);
RCT_EXPORT_VIEW_PROPERTY(defaultIndex, NSInteger);
RCT_EXPORT_VIEW_PROPERTY(pageIndex, NSInteger);
RCT_EXPORT_VIEW_PROPERTY(scrollEnabled, BOOL);
RCT_EXPORT_VIEW_PROPERTY(values, NSArray)
RCT_EXPORT_VIEW_PROPERTY(tabViewStyle, NSDictionary);
RCT_EXPORT_VIEW_PROPERTY(spinnerColor, NSString);
RCT_EXPORT_VIEW_PROPERTY(refresh, BOOL);
RCT_EXPORT_VIEW_PROPERTY(disableRefresh, BOOL);
RCT_EXPORT_VIEW_PROPERTY(onRefreshCallBack, RCTBubblingEventBlock)


RCT_EXPORT_METHOD(setPageIndex:(nonnull NSNumber *)reactTag index:(nonnull NSNumber *)index) {
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager,NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    PagingView *view = (PagingView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[PagingView class]]) {
      return;
    }
    [view setPageIndex:index.integerValue];
  }];
}

- (UIView *)view
{
  return [[PagingView alloc] init];
}

@end
