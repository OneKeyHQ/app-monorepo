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
//  self.bestAttemptContent.title = [NSString stringWithFormat:@"[NotificationService]: %@",self.bestAttemptContent.title];
  NSString * image = self.bestAttemptContent.userInfo[@"image"];
  //if exist
  if (image) {
    //download
    NSURL *imageURL = [NSURL URLWithString:image];
    [self downloadAndSave:imageURL handler:^(NSString *localPath) {
      if (localPath) {
        NSError *error = nil;
        UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image" URL:[NSURL fileURLWithPath:localPath] options:nil error:&error];
        if (!error) {
          self.bestAttemptContent.attachments = @[attachment];
        }
      }
      self.contentHandler(self.bestAttemptContent);
    }];
  } else {
    self.contentHandler(self.bestAttemptContent);
  }
}

- (void)downloadAndSave:(NSURL *)fileURL handler:(void (^)(NSString *localPath))handler {
  NSURLSession * session = [NSURLSession sharedSession];
  NSURLSessionDownloadTask *task = [session downloadTaskWithURL:fileURL completionHandler:^(NSURL * _Nullable location, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    NSString *localPath = nil;

    if (!error) {
      NSString *mimeType = [response MIMEType];
      NSString *extension = [self getExtensionForMimeType:mimeType];
      if(extension != nil) {
        NSString *fileName = [[[NSUUID UUID] UUIDString] stringByAppendingPathExtension:extension];
        NSString *localURL = [NSTemporaryDirectory() stringByAppendingPathComponent:fileName];
        if ([[NSFileManager defaultManager] moveItemAtPath:location.path toPath:localURL error:nil]) {
          localPath = localURL;
        }
      }
    }
    handler(localPath);
  }];
  [task resume];
}

- (NSString *)getExtensionForMimeType:(NSString *)mimeType {
    NSDictionary *mapping = @{
        @"image/gif" : @"gif",
        @"image/png" : @"png",
        @"image/jpeg" : @"jpg",
//        @"video/mp4" : @"mp4",
//        @"audio/mpeg" : @"mp3",
//        @"application/octet-stream" : @"",
    };
    return [mapping objectForKey:mimeType];
}

- (void)serviceExtensionTimeWillExpire {
    self.contentHandler(self.bestAttemptContent);
}

@end
