#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>


@interface RCTBridge (RNPrivateBridge)

- (void)executeSourceCode:(NSData *)sourceCode sync:(BOOL)sync;

@end
