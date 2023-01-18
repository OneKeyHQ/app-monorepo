
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSString (OKAdd)

- (NSString *)SHA256;
- (BOOL)ok_match:(NSString *)regex;
+ (NSString *)generateRequestId;
@end


NS_ASSUME_NONNULL_END
