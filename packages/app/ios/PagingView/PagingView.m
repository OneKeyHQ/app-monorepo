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
#import "UIColor+Hex.h"
#import <React/RCTUtils.h>
#import "JXCategoryView.h"

@interface PagingView ()<JXPagerViewDelegate,JXCategoryViewDelegate>
@property (nonatomic, strong) JXPagerView *pagingView;
@property (nonatomic, copy) RCTBubblingEventBlock onChange;
@property (nonatomic, copy) RCTBubblingEventBlock onRefreshCallBack;

@property (nonatomic, assign) CGFloat headerHeight;
@property (nonatomic, assign) NSInteger defaultIndex;
@property (nonatomic, assign) NSInteger pageIndex;
@property (nonatomic, assign) BOOL scrollEnabled;

@property (nonatomic, strong) UIView *headerView;
@property (nonatomic, strong) RNTabView *tabView;
@property (nonatomic, strong) UIRefreshControl *refreshControl;

@property (nonatomic, strong) NSArray *values;
@property (nonatomic, strong) NSDictionary *tabViewStyle;

@property (nonatomic, assign) BOOL refresh;
@property (nonatomic, assign) BOOL disableRefresh;
@property (nonatomic, copy) NSString *spinnerColor;

@property (nonatomic, assign) BOOL isDragging;

@property (nonatomic, assign) CGFloat offsetY;
@property (nonatomic, weak) UIWindow *window;


@end

@implementation PagingView

-(instancetype)init {
  self = [super init];
  if (self){
    NSLog(@"PagingView init");
  }
  return self;
}

- (void)setPageIndex:(NSInteger)index{
  [self.tabView.categoryView selectItemAtIndex:index];
}

-(void)setDefaultIndex:(NSInteger)defaultIndex {
  if (_defaultIndex == defaultIndex) {
    return;
  }
  _defaultIndex = defaultIndex;
}

-(void)setHeaderHeight:(CGFloat)headerHeight {
  BOOL needReload = _headerHeight != 0;
  if (_headerHeight == headerHeight) {
    return;
  }
  _headerHeight = headerHeight;
  if (needReload) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.pagingView resizeTableHeaderViewHeightWithAnimatable:NO duration:0 curve:0];
    });
  }
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
  self.tabView.frame = CGRectMake(0, CGRectGetHeight(self.headerView.frame), CGRectGetWidth(self.bounds), self.tabView.model.height);
}

-(UIRefreshControl *)refreshControl {
  if (!_refreshControl) {
    _refreshControl = [[UIRefreshControl alloc] init];
    [_refreshControl addTarget:self action:@selector(handleRefresh:) forControlEvents:UIControlEventValueChanged];
    if (_spinnerColor) {
      _refreshControl.tintColor = [UIColor colorWithHexString:_spinnerColor];
    }
  }
  return _refreshControl;
}

- (void)handleRefresh:(id)sender{
  if (_onRefreshCallBack) {
    _onRefreshCallBack(@{@"refresh":@(YES)});
  }
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

-(void)setRefresh:(BOOL)refresh {
  if (_refresh != refresh) {
    _refresh = refresh;
    if (_refresh) {
      [self.refreshControl beginRefreshing];
    } else {
      [self.refreshControl endRefreshing];
    }
  }
}

-(void)setSpinnerColor:(NSString *)spinnerColor {
  _spinnerColor = spinnerColor;
  if (_refreshControl) {
    _refreshControl.tintColor = [UIColor colorWithHexString:_spinnerColor];
    if (_refreshControl.isRefreshing) {
      [_refreshControl endRefreshing];
    }
  }
}

-(void)setDisableRefresh:(BOOL)disableRefresh {
  if (_disableRefresh != disableRefresh) {
    _disableRefresh = disableRefresh;
    if (_pagingView) {
      if (disableRefresh) {
        _pagingView.mainTableView.refreshControl = nil;
        [self.refreshControl removeFromSuperview];
      } else {
        _pagingView.mainTableView.refreshControl = self.refreshControl;
        [_pagingView.mainTableView addSubview:self.refreshControl];
      }
    }
  }
}


-(JXPagerView *)pagingView {
  if (!_pagingView) {
    _pagingView = [[JXPagerView alloc] initWithDelegate:self];
    _pagingView.mainTableView.backgroundColor = [UIColor clearColor];
    _pagingView.pinSectionHeaderVerticalOffset = 0;
    _pagingView.listContainerView.listCellBackgroundColor = [UIColor clearColor];
    _pagingView.isListHorizontalScrollEnabled = self.scrollEnabled;
    _pagingView.defaultSelectedIndex = self.defaultIndex;
    if (@available(iOS 15.0, *)) {
        _pagingView.mainTableView.sectionHeaderTopPadding = 0;
    }
    if (_disableRefresh == false) {
      _pagingView.mainTableView.refreshControl = self.refreshControl;
      [_pagingView.mainTableView addSubview:self.refreshControl];
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

-(UIWindow *)window{
  if(!_window) {
    _window = RCTKeyWindow();
  }
  return _window;
}
#pragma mark - JXPagingViewDelegate

- (void)pagerView:(JXPagerView *)pagerView mainTableViewWillBeginDragging:(UIScrollView *)scrollView{
  self.offsetY = scrollView.contentOffset.y;
  self.isDragging = YES;
}

- (void)pagerView:(JXPagerView *)pagerView mainTableViewDidScroll:(UIScrollView *)scrollView {
  CGRect rect = [self convertRect:self.frame toView:self.window];
  BOOL isPhone = [[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPhone;
  if (isPhone && CGRectGetMinX(rect) > 0 && self.isDragging) {
    CGPoint offset = scrollView.contentOffset;
    if (offset.y < 0) {
      offset.y = 0;
      [scrollView setContentOffset:offset];
    } else {
      if (offset.y != self.offsetY) {
        offset.y = self.offsetY;
        [scrollView setContentOffset:offset];
      }
    }
  }
}

- (void)pagerView:(JXPagerView *)pagerView mainTableViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate {
  self.isDragging = NO;
}

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
