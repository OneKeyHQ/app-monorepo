//
//  NSString+BXAdd.m
//  Electron-Cash
//
//  Created by xiaoliang on 2020/9/28.
//  Copyright © 2020 OneKey. All rights reserved..
//

#import "NSString+OKAdd.h"
#import <CommonCrypto/CommonDigest.h>
#import "NSData+StringToData.h"

@implementation NSString (OKAdd)

- (NSString *)SHA256
{
    const char *s = [self cStringUsingEncoding:NSASCIIStringEncoding];
    NSData *keyData = [NSData dataWithBytes:s length:strlen(s)];

    uint8_t digest[CC_SHA256_DIGEST_LENGTH] = {0};
    CC_SHA256(keyData.bytes, (CC_LONG)keyData.length, digest);
    NSData *out = [NSData dataWithBytes:digest length:CC_SHA256_DIGEST_LENGTH];
    NSString *hash = [NSData hexStringForData:out];
    return hash;
}

- (BOOL)ok_match:(NSString *)regex {
    NSPredicate *pred = [NSPredicate predicateWithFormat:@"SELF MATCHES %@", regex];
    BOOL isMatch = [pred evaluateWithObject:self];
    return isMatch;
}

+ (NSString *)generateRequestId {
  long long milliseconds = (long long)([[NSDate date] timeIntervalSince1970] * 1000.0);
  int r = arc4random_uniform(1000000);
  return [NSString stringWithFormat:@"%lld:%d", milliseconds, r];
}


@end
