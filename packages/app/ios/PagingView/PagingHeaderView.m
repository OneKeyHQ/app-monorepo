//
//  PagingHeaderView.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingHeaderView.h"
#import <React/RCTRootView.h>
#import <React/RCTAppSetupUtils.h>


@implementation PagingHeaderView



-(instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self){
    
    
    RCTRootView *mainRootView = (RCTRootView *)[[[[UIApplication sharedApplication] delegate] window] rootViewController].view;
    
    RCTRootView *view = [[RCTRootView alloc] initWithBridge:mainRootView.bridge
                          moduleName:@"PagingHeaderView"
                                          initialProperties: @{@"data":@"123"}];
    view.frame = frame;
    
    [self addSubview:view];
  }
  return self;
}

@end
