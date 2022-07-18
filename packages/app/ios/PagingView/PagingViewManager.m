//
//  PagingViewManager.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingViewManager.h"
#import "PagingView.h"

@implementation PagingViewManager
RCT_EXPORT_MODULE(PagingView)
RCT_EXPORT_VIEW_PROPERTY(onChange, RCTBubblingEventBlock)


- (UIView *)view
{
  return [[PagingView alloc] init];
}

@end
