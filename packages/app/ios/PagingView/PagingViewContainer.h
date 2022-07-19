//
//  PagingViewContainer.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import <UIKit/UIKit.h>
#import "JXPagerView.h"

NS_ASSUME_NONNULL_BEGIN

@interface PagingViewContainer : UIView<JXPagerViewListViewDelegate>
@property (nonatomic, weak) UIScrollView *scrollView;
-(instancetype)initWithReactView:(UIView *)reactView;

@end

NS_ASSUME_NONNULL_END
