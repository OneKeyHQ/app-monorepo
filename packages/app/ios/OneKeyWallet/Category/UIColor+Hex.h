//
//  UIColor+Hex.h
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface UIColor (Hex)
+ (UIColor *)colorWithHexString:(NSString *)color;
//从十六进制字符串获取颜色，
+ (UIColor *)colorWithHexString:(NSString *)color alpha:(CGFloat)alpha;
@end


NS_ASSUME_NONNULL_END
