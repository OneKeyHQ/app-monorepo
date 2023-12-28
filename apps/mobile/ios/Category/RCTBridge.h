#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>


@interface RCTBridge (RNPrivateBridge)


+ (instancetype)currentBridge;
- (void)executeSourceCode:(NSData *)sourceCode withSourceURL:(NSURL *)url sync:(BOOL)sync;


@end
