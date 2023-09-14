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
RCT_EXPORT_VIEW_PROPERTY(onPageChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPageScrollStateChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPageVerticalScroll, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(defaultIndex, NSInteger);
RCT_EXPORT_VIEW_PROPERTY(pageIndex, NSInteger);
RCT_EXPORT_VIEW_PROPERTY(scrollEnabled, BOOL);
RCT_EXPORT_VIEW_PROPERTY(values, NSArray)
RCT_EXPORT_VIEW_PROPERTY(tabViewStyle, NSDictionary);
RCT_EXPORT_VIEW_PROPERTY(spinnerColor, NSString);
RCT_EXPORT_VIEW_PROPERTY(refresh, BOOL);
RCT_EXPORT_VIEW_PROPERTY(disableRefresh, BOOL);
RCT_EXPORT_VIEW_PROPERTY(onRefreshCallBack, RCTBubblingEventBlock)


RCT_EXPORT_METHOD(setPageIndex:(nonnull NSNumber *)reactTag pageIndex:(NSInteger)pageIndex) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
        PagingView *view = (PagingView *)viewRegistry[reactTag];
        if (!!view && [view isKindOfClass:[PagingView class]]) {
            [view setPageIndex:pageIndex];
        }
    }];
}

RCT_EXPORT_METHOD(setRefreshing:(nonnull NSNumber *)reactTag refreshing:(BOOL)refreshing) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
        PagingView *view = (PagingView *)viewRegistry[reactTag];
        if (!!view && [view isKindOfClass:[PagingView class]]) {
            [view setRefresh:refreshing];
        }
    }];
}

RCT_EXPORT_METHOD(setHeaderHeight:(nonnull NSNumber *)reactTag headerHeight:(CGFloat)headerHeight) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
        PagingView *view = (PagingView *)viewRegistry[reactTag];
        if (!!view && [view isKindOfClass:[PagingView class]]) {
            [view setHeaderHeight:headerHeight];
        }
    }];
}

- (UIView *)view
{
  return [[PagingView alloc] init];
}

@end
