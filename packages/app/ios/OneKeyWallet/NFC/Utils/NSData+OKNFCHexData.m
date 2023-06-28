//
//  NSData+OKNFCHexData.m
//
//  Created by linleiqin on 2023/6/20.
//

#import "NSData+OKNFCHexData.h"

@implementation NSData (OKNFCHexData)
- (NSString *)toHexString {
    const unsigned char *dataBuffer = (const unsigned char *)[self bytes];

    if (!dataBuffer)
        return [NSString string];

    NSUInteger dataLength = [self length];
    NSMutableString *hexString = [NSMutableString stringWithCapacity:(dataLength * 2)];

    for (int i = 0; i < dataLength; ++i)
        [hexString appendString:[NSString stringWithFormat:@"%02lx", (unsigned long)dataBuffer[i]]];
    return [NSString stringWithString:hexString];
}

@end
