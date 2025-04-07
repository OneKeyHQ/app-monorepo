//
//  JPushManager.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/8/18.
//

#import "JPushManager.h"
#import <UserNotifications/UserNotifications.h>


@implementation JPushManager

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(registerNotification)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    JPUSHRegisterEntity * entity = [[JPUSHRegisterEntity alloc] init];
    entity.types = JPAuthorizationOptionAlert|JPAuthorizationOptionBadge|JPAuthorizationOptionSound|JPAuthorizationOptionProvidesAppNotificationSettings;
    [JPUSHService registerForRemoteNotificationConfig:entity delegate:self];
  });
}

+ (instancetype)shareInstance {
    static JPushManager *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[JPushManager alloc] init];
    });
    return instance;
}

- (id)init {
    self = [super init];
    if (self) {
      [JPUSHService requestNotificationAuthorization:^(JPAuthorizationStatus status) {
          if (status == JPAuthorizationStatusAuthorized) {
            // APNS
            JPUSHRegisterEntity * entity = [[JPUSHRegisterEntity alloc] init];
            entity.types = JPAuthorizationOptionAlert|JPAuthorizationOptionBadge|JPAuthorizationOptionSound|JPAuthorizationOptionProvidesAppNotificationSettings;
            [JPUSHService registerForRemoteNotificationConfig:entity delegate:self];
          }
      }];
    }
    return self;
}

//iOS 10 notification event callback
- (void)jpushNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:(UNNotificationResponse *)response withCompletionHandler: (void (^)(void))completionHandler {
    NSDictionary * userInfo = response.notification.request.content.userInfo;
  if([response.notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
    // Apns
    NSLog(@"iOS 10 APNS notification event callback");
    [JPUSHService handleRemoteNotification:userInfo];
    // Ensure that when the app is killed, 
    //  users can still receive notification click events after opening the app by clicking on a push message
    [[RCTJPushEventQueue sharedInstance]._notificationQueue insertObject:userInfo atIndex:0];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_OPENED_EVENT object:userInfo];
  }
  else {
    // Local notification
    NSLog(@"iOS 10 local notification message event callback");
    // Ensure that when the app is killed,
    //  users can still receive notification click events after opening the app by clicking on a push message
    [[RCTJPushEventQueue sharedInstance]._localNotificationQueue insertObject:userInfo atIndex:0];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_LOCAL_NOTIFICATION_OPENED_EVENT object:userInfo];
  }
  // System requires this method to be executed
  completionHandler();
}

//iOS 10 received message in foreground
- (void)jpushNotificationCenter:(UNUserNotificationCenter *)center  willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(NSInteger))completionHandler {
  NSDictionary * userInfo = notification.request.content.userInfo;
  if([notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
    // Apns
    NSLog(@"iOS 10 APNS received message in foreground");
    [JPUSHService handleRemoteNotification:userInfo];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_ARRIVED_EVENT object:userInfo];
  }
  else {
    // Local notification todo
    NSLog(@"iOS 10 local notification received message in foreground");
    [[NSNotificationCenter defaultCenter] postNotificationName:J_LOCAL_NOTIFICATION_ARRIVED_EVENT object:userInfo];
  }


  //Need to execute this method, choose whether to alert the user, 
  //  with Badge, Sound, Alert three types to choose from
  completionHandler(UNNotificationPresentationOptionList | UNNotificationPresentationOptionBanner);
  
  // **** By default, do not display foreground notifications, leave it to business logic ****
  // completionHandler(UNNotificationPresentationOptionNone);
}

- (void)jpushNotificationCenter:(UNUserNotificationCenter *)center openSettingsForNotification:(UNNotification *)notification {
  
}

- (void)jpushNotificationAuthorization:(JPAuthorizationStatus)status withInfo:(NSDictionary *)info {
  
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
