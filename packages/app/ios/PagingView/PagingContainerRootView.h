//
//  PagingContainerRootView.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import <React/RCTRootView.h>

NS_ASSUME_NONNULL_BEGIN

@class RCTScrollView;
@protocol PagingContainerRootViewDelegate <NSObject>
-(void)scrollViewDidFind:(RCTScrollView *)scrollView;

@end

@interface PagingContainerRootView : RCTRootView
@property(nonatomic,weak)id<PagingContainerRootViewDelegate> contrainDelegate;
@property(nonatomic,weak)RCTScrollView *scrollView;

@end

NS_ASSUME_NONNULL_END
