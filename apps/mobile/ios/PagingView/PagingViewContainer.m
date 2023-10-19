//
//  PagingViewContainer.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/18.
//

#import "PagingViewContainer.h"
#import "RCTScrollView+swizzled.h"

@interface PagingViewContainer ()<UIScrollViewDelegate>
@property (nonatomic, copy) void(^scrollCallback)(UIScrollView *scrollView);
@property (nonatomic, strong) UIView *reactView;

@end

@implementation PagingViewContainer

-(instancetype)initWithReactView:(UIView *)reactView {
  self = [super init];
  if (self){
    _reactView = reactView;
    [self addSubview:reactView];
    [self bindingScrollView];
  }
  return self;
}

-(void)bindingScrollView {
  UIView *tmpView = self;
  while (![tmpView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
    if (tmpView.subviews.count > 0) {
      tmpView = tmpView.subviews.firstObject;
    } else {
      break;
    }
  }
  if ([tmpView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
    RCTScrollView *scrollView = (RCTScrollView *)tmpView;
    self.reactScrollView.scrollViewDidScroll = nil;
    self.reactScrollView = scrollView;
    __weak typeof(self) weakSelf = self;
    self.reactScrollView.scrollViewDidScroll = ^(UIScrollView *scrollView) {
      [weakSelf scrollViewDidScroll:scrollView];
    };
    [self setNeedsLayout];
  }
}

-(void)layoutSubviews {
  [super layoutSubviews];
  self.reactView.frame = self.bounds;
  if (self.reactScrollView) {
    self.reactScrollView.frame = self.bounds;
    self.reactScrollView.scrollView.frame = self.bounds;
  }
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView {
  if (self.scrollCallback != nil) {
    self.scrollCallback(scrollView);
  }
}

- (void)listViewDidScrollCallback:(void (^)(UIScrollView *))callback {
  self.scrollCallback = callback;
}

- (UIScrollView *)listScrollView {
  return self.reactScrollView.scrollView;
}


- (UIView *)listView {
  return self;
}

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
  [self bindingScrollView];
  return [super hitTest:point withEvent:event];
}

- (void)dealloc {
  self.reactScrollView.scrollViewDidScroll = nil;
  self.reactScrollView = nil;
}
@end
