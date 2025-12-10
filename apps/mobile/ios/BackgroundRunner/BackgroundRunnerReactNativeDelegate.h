#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#if __has_include(<React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>)
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#elif __has_include(<React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>)
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#else
#import "RCTDefaultReactNativeFactoryDelegate.h"
#endif

#import <React/RCTComponent.h>

#include <string>
#include <vector>

NS_ASSUME_NONNULL_BEGIN

@interface BackgroundReactNativeDelegate : RCTDefaultReactNativeFactoryDelegate

//@property (nonatomic) std::shared_ptr<const facebook::react::SandboxReactNativeViewEventEmitter> eventEmitter;
@property (nonatomic, assign) BOOL hasOnMessageHandler;
@property (nonatomic, assign) BOOL hasOnErrorHandler;

@property (nonatomic, readwrite) std::string jsBundleSource;

@property (nonatomic, readwrite) std::string origin;

@property (nonatomic, copy) void (^onMessageCallback)(NSString *message);

/**
 * Initializes the delegate.
 * @return Initialized delegate instance with filtered module access
 */
- (instancetype)init;

/**
 * Posts a message to the JavaScript runtime.
 * @param message C++ string containing the JSON.stringified message
 */
- (void)postMessage:(const std::string &)message;

/**
 * Routes a message to a specific sandbox delegate.
 * @param message The message to route
 * @param targetId The ID of the target sandbox
 * @return true if the message was successfully routed, false otherwise
 */
- (bool)routeMessage:(const std::string &)message toSandbox:(const std::string &)targetId;

@end

NS_ASSUME_NONNULL_END
