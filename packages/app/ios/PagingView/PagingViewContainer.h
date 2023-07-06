//
//  PagingViewContainer.h
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/18.
//

#import <React/RCTView.h>
#import "JXPagerView.h"
#import <React/RCTScrollView.h>

NS_ASSUME_NONNULL_BEGIN

@interface PagingViewContainer : RCTView<JXPagerViewListViewDelegate>
@property (nonatomic, weak) RCTScrollView *reactScrollView;
-(instancetype)initWithReactView:(UIView *)reactView;
-(void)bindingScrollView;
@end

NS_ASSUME_NONNULL_END
