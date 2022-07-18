//
//  PagingView.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingView.h"
#import <JXPagingView/JXPagerView.h>
#import "PagingViewContainer.h"
#import "PagingHeaderView.h"



static const CGFloat JXTableHeaderViewHeight = 200;
static const CGFloat BigHeightForHeaderInSection = 50;

@interface PagingView ()<JXPagerViewDelegate>
@property (nonatomic, strong) JXPagerView *pagingView;
@property (nonatomic, copy) RCTBubblingEventBlock onChange;
@property (nonatomic, strong) PagingHeaderView *headerView;
@property (nonatomic, strong) UIView *categoryContainerView;

@end

@implementation PagingView

-(void)layoutSubviews {
  [super layoutSubviews];
  self.pagingView.frame = self.bounds;
}

-(JXPagerView *)pagingView {
  if (!_pagingView) {
    _pagingView = [[JXPagerView alloc] initWithDelegate:self];
    _pagingView.mainTableView.backgroundColor = [UIColor clearColor];
    _pagingView.pinSectionHeaderVerticalOffset = 0;
    
    if (@available(iOS 15.0, *)) {
        self.pagingView.mainTableView.sectionHeaderTopPadding = 0;
    }
    [self addSubview:_pagingView];
  }
  return _pagingView;
}

-(PagingHeaderView *)headerView {
  if (!_headerView) {
    _headerView = [[PagingHeaderView alloc] initWithFrame:CGRectMake(0, 0, [UIScreen mainScreen].bounds.size.width, JXTableHeaderViewHeight)];
    _headerView.backgroundColor = [UIColor clearColor];

  }
  return _headerView;
}

//-(void)setHeaderView:(UIView *)headerView {
//  NSLog(@"headerView = %@",headerView);
//  _headerView = headerView;
//}



-(UIView *)categoryContainerView {
  if (!_categoryContainerView) {
    _categoryContainerView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, [UIScreen mainScreen].bounds.size.width, BigHeightForHeaderInSection)];
    _categoryContainerView.backgroundColor = [UIColor blueColor];
  }
  return _categoryContainerView;
}


#pragma mark - JXPagingViewDelegate

- (UIView *)tableHeaderViewInPagerView:(JXPagerView *)pagerView {
    return self.headerView;
}

- (NSUInteger)tableHeaderViewHeightInPagerView:(JXPagerView *)pagerView {
    return JXTableHeaderViewHeight;
}

- (NSUInteger)heightForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
    return BigHeightForHeaderInSection;
}

- (UIView *)viewForPinSectionHeaderInPagerView:(JXPagerView *)pagerView {
    return self.categoryContainerView;
}

- (NSInteger)numberOfListsInPagerView:(JXPagerView *)pagerView {
    return 3;
}

- (id<JXPagerViewListViewDelegate>)pagerView:(JXPagerView *)pagerView initListAtIndex:(NSInteger)index {
  
  PagingViewContainer *list = [[PagingViewContainer alloc] initWithTag:1000 + index];
  if (self.onChange) {
    self.onChange(@{@"index":@(index)});
  }
  return list;
}

@end
