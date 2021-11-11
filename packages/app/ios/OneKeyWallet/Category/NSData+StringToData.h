//
//  NSData+StringToData.h
//  OneKey
//
//  Created by xiaoliang on 2020/11/17.
//  Copyright © 2020 OneKey. All rights reserved..
//
#import <Foundation/Foundation.h>

@interface NSData (StringToData)
+ (NSString*)hexStringForData:(NSData*)data;
@end
