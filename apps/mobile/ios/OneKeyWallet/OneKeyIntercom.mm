#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <TargetConditionals.h>

#if !TARGET_OS_MACCATALYST
#import <Intercom/Intercom.h>
#import <IntercomModule.h>
#endif

static BOOL OneKeyIntercomInitialized = NO;

extern "C" void OneKeyInitializeIntercom(void)
{
#if !TARGET_OS_MACCATALYST
  NSString *path = [NSBundle.mainBundle pathForResource:@"OneKeyIntercomConfiguration"
                                               ofType:@"plist"];
  NSDictionary *configuration = path ? [NSDictionary dictionaryWithContentsOfFile:path] : nil;
  NSString *apiKey = configuration[@"iosApiKey"];
  if (![apiKey isKindOfClass:NSString.class] || apiKey.length == 0) {
    return;
  }
  @try {
    [IntercomModule initialize:apiKey withAppId:@"vbbj4ssb"];
    [Intercom setLauncherVisible:NO];
    [Intercom setInAppMessagesVisible:NO];
    [Intercom suppressProactiveContent:@[@(IntercomProactiveContentTypeCarousel),
                                        @(IntercomProactiveContentTypeSurvey)]];
    OneKeyIntercomInitialized = YES;
  } @catch (NSException *exception) {
    // Do not log SDK exceptions that may contain initialization credentials.
    NSLog(@"Intercom native initialization failed");
  }
#endif
}

@interface OneKeyIntercom : NSObject <RCTBridgeModule>
@end

@implementation OneKeyIntercom
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return YES; }

- (NSDictionary *)constantsToExport
{
  return @{@"initialized": @(OneKeyIntercomInitialized)};
}
@end
