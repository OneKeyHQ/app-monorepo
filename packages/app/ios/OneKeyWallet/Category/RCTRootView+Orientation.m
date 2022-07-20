//
//  RCTRootView+Orientation.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/14.
//

#import "RCTRootView+Orientation.h"

@implementation RCTRootView (Orientation)

-(void)layoutSubviews {
  [super layoutSubviews];
  for (UIView *subView in self.subviews) {
    subView.frame = self.bounds;
  }
}

@end
