//
//  PagingView.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingView.h"
#import <JXPagingView/JXPagerView.h>
#import "PagingViewContainer.h"
#import <React/UIView+React.h>

@interface PagingView ()<JXPagerViewDelegate>
@property (nonatomic, strong) JXPagerView *pagingView;
@property (nonatomic, copy) RCTBubblingEventBlock onChange;
@property (nonatomic, assign) CGFloat headerHeight;
@property (nonatomic, assign) NSInteger defaultIndex;
@property (nonatomic, assign) NSInteger pageIndex;

@property (nonatomic, strong) UIView *headerView;
@property (nonatomic, strong) UIView *categoryContainerView;
//@property (nonatomic, strong) NSMapTable *cachelistContainer;

@end

@implementation PagingView

-(instancetype)init {
  self = [super init];
  if (self){
    NSLog(@"PagingView init");
    self.tag = 500;
  }
  return self;
}

-(void)layoutSubviews {
  [super layoutSubviews];
  _pagingView.frame = self.bounds;
}

- (void)goTo:(NSInteger)pageIndex {
  if (_pageIndex == pageIndex) {
    return;
  }
  _pageIndex = pageIndex;
  CGFloat pageWidth = CGRectGetWidth(self.frame);
  [self.pagingView.listContainerView didClickSelectedItemAtIndex:pageIndex];
  [self.pagingView.listContainerView.scrollView setContentOffset:CGPointMake(pageWidth * pageIndex, 0) animated:YES];
}


- (void)didUpdateReactSubviews {
//  if (self.reactSubviews.count != 3) {
//    return;
//  }
  self.headerView = self.reactSubviews.firstObject;
  self.categoryContainerView = self.reactSubviews[1];
  [self.pagingView reloadData];
}


-(JXPagerView *)pagingView {
  if (!_pagingView) {
    _pagingView = [[JXPagerView alloc] initWithDelegate:self];
    _pagingView.mainTableView.backgroundColor = [UIColor clearColor];
    _pagingView.pinSectionHeaderVerticalOffset = 0;
    _pagingView.listContainerView.listCellBackgroundColor = [UIColor clearColor];
    _pagingView.isListHorizontalScrollEnabled = false;
    _pagingView.defaultSelectedIndex = self.defaultIndex;
    if (@available(iOS 15.0, *)) {
        self.pagingView.mainTableView.sectionHeaderTopPadding = 0;
    }
    [self addSubview:_pagingView];
  }
  return _pagingView;
}

#pragma mark - JXPagingViewDelegate

- (UIView *)tableHeaderViewInPagerView:(JXPagerView *)pagerView {
    return self.headerView;
}

- (NSUInteger)tableHeaderViewHeightInPagerView:(JXPagerView *)pagerView {
    return self.headerHeight;
}

- (NSUInteger)heightForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
    return CGRectGetHeight(self.categoryContainerView.frame);
}

- (UIView *)viewForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
    return self.categoryContainerView;
}

- (NSInteger)numberOfListsInPagerView:(JXPagerView *)pagerView {

  return self.reactSubviews.count - 2;
}

- (id<JXPagerViewListViewDelegate>)pagerView:(JXPagerView *)pagerView initListAtIndex:(NSInteger)index {
  PagingViewContainer *view = [[PagingViewContainer alloc] initWithReactView:self.reactSubviews[index + 2]];
  return view;
}

-(void)dealloc {
  NSLog(@"pagingview dealloc");
}
@end
