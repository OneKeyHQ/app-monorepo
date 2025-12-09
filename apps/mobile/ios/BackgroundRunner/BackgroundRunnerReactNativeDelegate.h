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

#ifdef __cplusplus
#include <string>
#include <vector>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface BackgroundReactNativeDelegate : RCTDefaultReactNativeFactoryDelegate

//@property (nonatomic) std::shared_ptr<const facebook::react::SandboxReactNativeViewEventEmitter> eventEmitter;
@property (nonatomic, assign) BOOL hasOnMessageHandler;
@property (nonatomic, assign) BOOL hasOnErrorHandler;

#ifdef __cplusplus
@property (nonatomic, readwrite) std::string origin;
@property (nonatomic, readwrite) std::string jsBundleSource;

/**
 * Sets the list of allowed TurboModules for this sandbox instance.
 * Only modules in this list will be accessible to the JavaScript runtime.
 */
@property (nonatomic, readwrite) std::set<std::string> allowedTurboModules;

/**
 * Sets the list of allowed origins for this sandbox instance.
 * Only sandboxes with origins in this list can send messages to this sandbox.
 */
@property (nonatomic, readwrite) std::set<std::string> allowedOrigins;

#endif
/**
 * Initializes the delegate.
 * @return Initialized delegate instance with filtered module access
 */
- (instancetype)init;

#ifdef __cplusplus
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
#endif

@end

NS_ASSUME_NONNULL_END
