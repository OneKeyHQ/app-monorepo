//
//  PagingView.h
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/18.
//

#import <React/RCTView.h>

NS_ASSUME_NONNULL_BEGIN

typedef NSString* _Nonnull (^RenderItemBlock)(NSDictionary *body);


@interface PagingView : RCTView

- (void)setHeaderHeight:(CGFloat)headerHeight;

- (void)setPageIndex:(NSInteger)index;

- (void)setRefresh:(BOOL)refresh;

@end

NS_ASSUME_NONNULL_END
