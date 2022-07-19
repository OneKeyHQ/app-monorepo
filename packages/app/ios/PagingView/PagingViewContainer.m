//
//  PagingViewContainer.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingViewContainer.h"

#import <React/RCTScrollView.h>
#import <React/RCTRootViewDelegate.h>
#import <React/RCTAppSetupUtils.h>

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
  UIView *tmpView = _reactView;
  while (![tmpView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
    if (tmpView.subviews.count > 0) {
      tmpView = tmpView.subviews.firstObject;
    } else {
      break;
    }
  }
  if ([tmpView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
    self.scrollView = [(RCTScrollView *)tmpView scrollView];
    self.scrollView.delegate = self;
  }
}

-(void)layoutSubviews {
  [super layoutSubviews];
  self.reactView.frame = self.bounds;
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
    return self.scrollView;
}


- (UIView *)listView {
    return self;
}


@end
