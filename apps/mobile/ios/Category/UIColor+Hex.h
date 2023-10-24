//
//  UIColor+Hex.h
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface UIColor (Hex)
//从十六进制字符串获取颜色，#445566EE, 最后两位是透明度
+ (UIColor *)colorWithHexString:(NSString *)color;
@end


NS_ASSUME_NONNULL_END
