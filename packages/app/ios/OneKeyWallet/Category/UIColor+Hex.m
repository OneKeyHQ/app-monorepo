//
//  UIColor+Hex.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import "UIColor+Hex.h"

@implementation UIColor (Hex)
 
+ (UIColor *)colorWithHexString:(NSString *)color alpha:(CGFloat)alpha
{
    NSString *cString = [[color stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]] uppercaseString];
    if ([cString length] < 6)
    {
        return [UIColor clearColor];
    }
    if ([cString hasPrefix:@"0X"])
    {
        cString = [cString substringFromIndex:2];
    }
    if ([cString hasPrefix:@"#"])
    {
        cString = [cString substringFromIndex:1];
    }
    if ([cString length] != 6)
    {
        return [UIColor clearColor];
    }
     
    // Separate into r, g, b substrings
    NSRange range;
    range.location = 0;
    range.length = 2;
    //r
    NSString *rString = [cString substringWithRange:range];
    //g
    range.location = 2;
    NSString *gString = [cString substringWithRange:range];
    //b
    range.location = 4;
    NSString *bString = [cString substringWithRange:range];
    // Scan values
    unsigned int r, g, b;
    [[NSScanner scannerWithString:rString] scanHexInt:&r];
    [[NSScanner scannerWithString:gString] scanHexInt:&g];
    [[NSScanner scannerWithString:bString] scanHexInt:&b];
    return [UIColor colorWithRed:((float)r / 255.0f) green:((float)g / 255.0f) blue:((float)b / 255.0f) alpha:alpha];
}
 
+ (UIColor *)colorWithHexString:(NSString *)color
{
    return [self colorWithHexString:color alpha:1.0f];
}

+ (UIColor *)colorWithRGBAHexString:(NSString *)color
{
    NSString *cString = [[color stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]] uppercaseString];
    
    if ([cString hasPrefix:@"0X"]) {
        cString = [cString substringFromIndex:2];
    }
    if ([cString hasPrefix:@"#"]) {
        cString = [cString substringFromIndex:1];
    }
    
    // 如果颜色字符串是6个字符，直接调用 colorWithHexString:
    if ([cString length] == 6) {
        return [self colorWithHexString:cString];
    }
    
    // 如果颜色字符串是8个字符
    if ([cString length] == 8) {
        // 获取颜色部分 #RRGGBB
        NSString *rgbHexString = [cString substringWithRange:NSMakeRange(0, 6)];
        
        // 获取透明度部分 AA
        NSString *aString = [cString substringWithRange:NSMakeRange(6, 2)];
        unsigned int alpha;
        [[NSScanner scannerWithString:aString] scanHexInt:&alpha];
        
        return [self colorWithHexString:rgbHexString alpha:((CGFloat)alpha / 255.0f)];
    }
    
    return [UIColor clearColor];
}
 
@end
