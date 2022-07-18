//
//  PagingContainerRootView.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingContainerRootView.h"
#import <React/RCTView.h>

@implementation PagingContainerRootView

-(UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
  if (!self.scrollView) {
    if (self.contentView.subviews.count > 0) {
      UIView *rctView = (UIView *)self.contentView.subviews.firstObject;
      while (![rctView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
        if (rctView.subviews.count > 0) {
          rctView = rctView.subviews.firstObject;
        } else {
          break;
        }
      }
      if ([rctView isKindOfClass:NSClassFromString(@"RCTScrollView")]) {
        self.scrollView = (RCTScrollView *)rctView;
        if ([self.contrainDelegate respondsToSelector:@selector(scrollViewDidFind:)]) {
          [self.contrainDelegate scrollViewDidFind:self.scrollView];
        }
      }
    }
  }
  return [super hitTest:point withEvent:event];
}

@end


