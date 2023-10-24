//
//  UIColor+Hex.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import "UIColor+Hex.h"

@implementation UIColor (Hex)
 
+ (UIColor *)colorWithHexString:(NSString *)color
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
    if ([cString length] == 6)
    {
      cString = [cString stringByAppendingString:@"ff"];
    }
     
    // Separate into r, g, b substrings
    NSRange range;
    range.location = 0;
    range.length = 2;
    //r
    NSString *rString = [cString substringWithRange:range];
    //g
    range.location += 2;
    NSString *gString = [cString substringWithRange:range];
    //b
    range.location += 2;
    NSString *bString = [cString substringWithRange:range];

    //a
    range.location += 2;
    NSString *aString = [cString substringWithRange:range];

    // Scan values
    unsigned int r, g, b, a;
    [[NSScanner scannerWithString:rString] scanHexInt:&r];
    [[NSScanner scannerWithString:gString] scanHexInt:&g];
    [[NSScanner scannerWithString:bString] scanHexInt:&b];
    [[NSScanner scannerWithString:aString] scanHexInt:&a];
    return [UIColor colorWithRed:((float)r / 255.0f) green:((float)g / 255.0f) blue:((float)b / 255.0f) alpha:((float)a / 255.0f)];
}
 
@end
