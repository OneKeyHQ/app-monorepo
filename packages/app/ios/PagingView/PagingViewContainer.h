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
@property (nonatomic, copy) void(^listScrollCallback)(UIScrollView *scrollView);
-(instancetype)initWithTag:(NSInteger)flag;

@end

NS_ASSUME_NONNULL_END
