//
//  NSString+OKNFCHexStr.m
//
//  Created by linleiqin on 2023/6/20.
//

#import "NSString+OKNFCHexStr.h"

@implementation NSString(OKNFCHexStr)

- (NSData *)dataFromHexString {
    NSString *string = [self lowercaseString];
    NSMutableData *data= [NSMutableData new];
    unsigned char whole_byte;
    char byte_chars[3] = {'\0','\0','\0'};
    int i = 0;
    NSUInteger length = string.length;
    while (i < length-1) {
        char c = [string characterAtIndex:i++];
        if (c < '0' || (c > '9' && c < 'a') || c > 'f')
            continue;
        byte_chars[0] = c;
        byte_chars[1] = [string characterAtIndex:i++];
        whole_byte = strtol(byte_chars, NULL, 16);
        [data appendBytes:&whole_byte length:1];
    }
    return data;
}

- (NSString *)hexString {
    NSData* nsData = [self dataUsingEncoding:NSUTF8StringEncoding];
    const char* data = (const char*)[nsData bytes];
    NSUInteger len = nsData.length;
    NSMutableString* hex = [NSMutableString string];
    for(int i = 0; i < len; ++i)[hex appendFormat:@"%02X", data[i]];
    return hex;
}
@end
