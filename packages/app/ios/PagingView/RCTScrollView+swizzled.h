//
//  RCTScrollView+onScroll.h
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/20.
//

#import <React/RCTScrollView.h>

typedef void (^ScrollViewDidScrollBlock)(UIScrollView *scrollView);

@interface RCTScrollView (swizzled)
@property (nonatomic, copy) ScrollViewDidScrollBlock scrollViewDidScroll;

@end

