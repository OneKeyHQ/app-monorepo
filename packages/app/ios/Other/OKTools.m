//
//  OKTools.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/3/1.
//

#import "OKTools.h"

@implementation OKTools

+ (BOOL)isChineseLan {
  NSArray *appLanguages = [[NSUserDefaults standardUserDefaults] objectForKey:@"AppleLanguages"];
  NSString *languageName = appLanguages.firstObject;
  if (languageName && languageName.length > 0) {
    return [languageName containsString:@"zh-Han"];
  }
  return NO;
}

@end
