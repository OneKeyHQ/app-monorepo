#import <React/RCTBridgeModule.h>
#import "React/RCTBridge.h"
#import "React/RCTLog.h"
#import "React/RCTEventDispatcher.h"
#import <React/RCTEventEmitter.h>

#import "GCDWebServer.h"
#import "GCDWebServerDataResponse.h"
#import "GCDWebServerDataRequest.h"

@interface HTTPServerManager : RCTEventEmitter <RCTBridgeModule>

@end
