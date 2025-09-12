#import "RCTRootViewBackground.h"
#import <CocoaLumberjack/CocoaLumberjack.h>

static const DDLogLevel ddLogLevel = DDLogLevelVerbose;

@implementation RCTRootViewBackground

RCT_EXPORT_MODULE(RootViewBackground);

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(setBackground:(double)r g:(double)g b:(double)b a:(double)a)
{
  dispatch_async( dispatch_get_main_queue(), ^{
    UIColor *color = [[UIColor alloc] initWithRed:r/255 green:g/255 blue:b/255 alpha:a/255];
    UIViewController *rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
    rootViewController.view.backgroundColor = color;
    DDLogDebug(@"setRootViewBackground: rgba(%f, %f, %f, %f)", r, g, b, a);
  });
}

@end
