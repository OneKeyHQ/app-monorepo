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
#import "RNTabView.h"

@interface PagingView ()<JXPagerViewDelegate,JXCategoryViewDelegate>
@property (nonatomic, strong) JXPagerView *pagingView;
@property (nonatomic, copy) RCTBubblingEventBlock onChange;
@property (nonatomic, assign) CGFloat headerHeight;
@property (nonatomic, assign) NSInteger defaultIndex;
@property (nonatomic, assign) NSInteger pageIndex;
@property (nonatomic, assign) BOOL scrollEnabled;

@property (nonatomic, strong) UIView *headerView;
@property (nonatomic, strong) RNTabView *tabView;

@property (nonatomic, strong) NSArray *values;
@property (nonatomic, strong) NSDictionary *tabViewStyle;

@end

@implementation PagingView

-(instancetype)init {
  self = [super init];
  if (self){
    NSLog(@"PagingView init");
  }
  return self;
}

-(void)setDefaultIndex:(NSInteger)defaultIndex {
  if (_defaultIndex == defaultIndex) {
    return;
  }
  _defaultIndex = defaultIndex;
//  [self reloadTabView];
}

-(void)setTabViewStyle:(NSDictionary *)tabViewStyle {
  if ([_tabViewStyle isEqualToDictionary:tabViewStyle]) {
    return;
  }
  _tabViewStyle = tabViewStyle;
  [self reloadTabView];
}

-(void)setValues:(NSArray *)values {
  if ([_values isEqualToArray:values]) {
    return;
  }
  _values = values;
  [self reloadTabView];
}

-(void)reloadTabView {
  if (_tabView) {
    _tabView.tabViewStyle = _tabViewStyle;
    _tabView.values = _values;
    [_tabView reloadData];
    _tabView.categoryView.listContainer = (id<JXCategoryViewListContainer>)self.pagingView.listContainerView;
    _tabView.categoryView.delegate = self;
  }
}

-(void)layoutSubviews {
  [super layoutSubviews];
  self.pagingView.frame = self.bounds;
  self.tabView.frame = CGRectMake(0, 0, CGRectGetWidth(self.bounds), self.tabView.model.height);
}

-(RNTabView *)tabView {
  if (!_tabView) {
    _tabView = [[RNTabView alloc] initWithValues:_values tabViewStyle:_tabViewStyle];
    _tabView.defaultIndex = _defaultIndex;
    _tabView.frame = CGRectMake(0, 0, CGRectGetWidth(self.frame), _tabView.model.height);
    _tabView.categoryView.listContainer = (id<JXCategoryViewListContainer>)self.pagingView.listContainerView;
    _tabView.categoryView.delegate = self;
  }
  return _tabView;
}

- (void)didUpdateReactSubviews {
  self.headerView = self.reactSubviews.firstObject;
  [self.pagingView reloadData];
}

-(JXPagerView *)pagingView {
  if (!_pagingView) {
    _pagingView = [[JXPagerView alloc] initWithDelegate:self];
    _pagingView.mainTableView.backgroundColor = [UIColor clearColor];
    _pagingView.pinSectionHeaderVerticalOffset = 0;
    _pagingView.listContainerView.listCellBackgroundColor = [UIColor clearColor];
    _pagingView.isListHorizontalScrollEnabled = YES;
    _pagingView.defaultSelectedIndex = self.defaultIndex;
    if (@available(iOS 15.0, *)) {
        _pagingView.mainTableView.sectionHeaderTopPadding = 0;
    }
    [self addSubview:_pagingView];
  }
  return _pagingView;
}

- (void)categoryView:(JXCategoryBaseView *)categoryView didSelectedItemAtIndex:(NSInteger)index {
  if (_onChange) {
    NSDictionary *value = _values[index];
    _onChange(@{@"tabName":value[@"name"],@"index":@(index)});
  }
}

#pragma mark - JXPagingViewDelegate

- (UIView *)tableHeaderViewInPagerView:(JXPagerView *)pagerView {
    return self.headerView;
}

- (NSUInteger)tableHeaderViewHeightInPagerView:(JXPagerView *)pagerView {
    return self.headerHeight;
}

- (NSUInteger)heightForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
  
    return self.tabView.model.height;
}

- (UIView *)viewForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
  return self.tabView;
}

- (NSInteger)numberOfListsInPagerView:(JXPagerView *)pagerView {
  return self.reactSubviews.count - 1;
}

- (id<JXPagerViewListViewDelegate>)pagerView:(JXPagerView *)pagerView initListAtIndex:(NSInteger)index {
  PagingViewContainer *view = [[PagingViewContainer alloc] initWithReactView:self.reactSubviews[index + 1]];
  return view;
}

-(void)dealloc {
  NSLog(@"pagingview dealloc");
}
@end
