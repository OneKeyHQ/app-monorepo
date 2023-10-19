//
//  RCTScrollView+onScroll.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/20.
//

#import "RCTScrollView+swizzled.h"
#import <objc/runtime.h>
static const void *scrollViewDidScrollKey = @"scrollViewDidScrollKey";

@implementation RCTScrollView (swizzled)

+ (void)load{
    static dispatch_once_t token;
    dispatch_once(&token, ^{
        SEL orginSel = @selector(scrollViewDidScroll:);
        SEL overrideSel = @selector(swizzled_scrollViewDidScroll:);
        Method originMethod = class_getInstanceMethod([self class], orginSel);
        Method overrideMethod = class_getInstanceMethod([self class], overrideSel);
        if (class_addMethod([self class], orginSel, method_getImplementation(overrideMethod) , method_getTypeEncoding(originMethod))) {
            class_replaceMethod([self class],overrideSel,method_getImplementation(originMethod),method_getTypeEncoding(originMethod));
        }else{
            method_exchangeImplementations(originMethod, overrideMethod);
        }
    });
}


-(void)swizzled_scrollViewDidScroll:(UIScrollView *)scrollView
{
  if (self.scrollViewDidScroll) {
    self.scrollViewDidScroll(scrollView);
  }
  [self swizzled_scrollViewDidScroll:scrollView];
}

- (ScrollViewDidScrollBlock)scrollViewDidScroll {
    return objc_getAssociatedObject(self, scrollViewDidScrollKey);
}

-(void)setScrollViewDidScroll:(ScrollViewDidScrollBlock)scrollViewDidScroll {
  objc_setAssociatedObject(self, scrollViewDidScrollKey, scrollViewDidScroll, OBJC_ASSOCIATION_COPY);
}

@end
