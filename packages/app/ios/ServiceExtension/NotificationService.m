//
//  NotificationService.m
//  ServiceExtension
//
//  Created by linleiqin on 2023/2/27.
//

#import "NotificationService.h"

@interface NotificationService ()

@property (nonatomic, strong) void (^contentHandler)(UNNotificationContent *contentToDeliver);
@property (nonatomic, strong) UNMutableNotificationContent *bestAttemptContent;

@end

@implementation NotificationService


- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request withContentHandler:(void (^)(UNNotificationContent * _Nonnull))contentHandler {
  self.contentHandler = contentHandler;
  self.bestAttemptContent = [request.content mutableCopy];
  self.bestAttemptContent.title = [NSString stringWithFormat:@"[NotificationService]: %@",self.bestAttemptContent.title];

  NSString * image = self.bestAttemptContent.userInfo[@"image"];
  //if exist
  if (image) {
    //download
    NSURL *imageURL = [NSURL URLWithString:image];
    [self downloadAndSave:imageURL handler:^(NSString *localPath) {
      if (localPath) {
        UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image" URL:[NSURL fileURLWithPath:localPath] options:nil error:nil];
        self.bestAttemptContent.attachments = @[attachment];
      }
      self.contentHandler(self.bestAttemptContent);
    }];
  } else {
    self.contentHandler(self.bestAttemptContent);
  }
}

- (void)downloadAndSave:(NSURL *)fileURL handler:(void (^)(NSString *))handler {
  NSURLSession * session = [NSURLSession sharedSession];
  NSURLSessionDownloadTask *task = [session downloadTaskWithURL:fileURL completionHandler:^(NSURL * _Nullable location, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    NSString *localPath = nil;
    if (!error) {
      NSString * localURL = [NSString stringWithFormat:@"%@/%@", NSTemporaryDirectory(),fileURL.lastPathComponent];
      if ([[NSFileManager defaultManager] moveItemAtPath:location.path toPath:localURL error:nil]) {
        localPath = localURL;
      }
    }
    handler(localPath);
  }];
  [task resume];
}

- (void)serviceExtensionTimeWillExpire {
    // Called just before the extension will be terminated by the system.
    // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
    self.contentHandler(self.bestAttemptContent);
}

@end
