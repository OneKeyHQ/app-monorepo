//
//  BundleUpdateModule.m
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//

#import "BundleUpdateModule.h"
#import <React/RCTLog.h>
#import <CommonCrypto/CommonDigest.h>
#import <React/RCTUtils.h>

@implementation BundleUpdateModule

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
    return @[@"update/start", @"update/downloading", @"update/downloaded", @"update/error"];
}

- (dispatch_queue_t)methodQueue {
    return dispatch_queue_create("com.onekey.bundleupdate", DISPATCH_QUEUE_SERIAL);
}

- (void)log:(NSString *)name message:(NSString *)message {
    NSString *timestamp = [NSDateFormatter localizedStringFromDate:[NSDate date]
                                                         dateStyle:NSDateFormatterNoStyle
                                                         timeStyle:NSDateFormatterMediumStyle];
    RCTLogInfo(@"%@ | INFO : app => native => BundleUpdate:%@: %@", timestamp, name, message);
}

- (void)sendEvent:(NSString *)eventName params:(NSDictionary *)params {
    [self sendEventWithName:eventName body:params];
}

- (void)sendDownloadError:(NSError *)error promise:(RCTPromiseRejectBlock)reject {
    NSDictionary *params = @{@"message": error.localizedDescription ?: @"Unknown error"};
    [self sendEvent:@"update/error" params:params];
    reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
}

- (NSString *)calculateSHA256:(NSString *)filePath {
    NSFileHandle *fileHandle = [NSFileHandle fileHandleForReadingAtPath:filePath];
    if (!fileHandle) {
        return nil;
    }
    
    CC_SHA256_CTX sha256Context;
    CC_SHA256_Init(&sha256Context);
    
    NSData *data;
    while ((data = [fileHandle readDataOfLength:8192]).length > 0) {
        CC_SHA256_Update(&sha256Context, data.bytes, (CC_LONG)data.length);
    }
    
    [fileHandle closeFile];
    
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256_Final(hash, &sha256Context);
    
    NSMutableString *hashString = [NSMutableString string];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [hashString appendFormat:@"%02x", hash[i]];
    }
    
    return [hashString copy];
}

- (NSString *)extractSHA256FromASCFile:(NSString *)ascFilePath {
    NSError *error;
    NSString *ascContent = [NSString stringWithContentsOfFile:ascFilePath
                                                     encoding:NSUTF8StringEncoding
                                                        error:&error];
    if (error || !ascContent) {
        [self log:@"extractSHA256" message:[NSString stringWithFormat:@"Error reading ASC file: %@", error.localizedDescription]];
        return nil;
    }
    
    // Parse ASC file to extract SHA256
    // This is a simplified implementation - in production, you'd want proper GPG verification
    NSArray *lines = [ascContent componentsSeparatedByString:@"\n"];
    for (NSString *line in lines) {
        if ([line containsString:@"SHA256"]) {
            NSArray *components = [line componentsSeparatedByString:@" "];
            for (NSString *component in components) {
                if (component.length == 64 && [self isValidHexString:component]) {
                    return component;
                }
            }
        }
    }
    
    return nil;
}

- (BOOL)isValidHexString:(NSString *)string {
    NSCharacterSet *hexCharacterSet = [NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdefABCDEF"];
    return [[string stringByTrimmingCharactersInSet:hexCharacterSet] isEqualToString:@""];
}

- (BOOL)verifyBundleSignature:(NSString *)bundlePath ascPath:(NSString *)ascPath {
    NSString *calculatedSHA256 = [self calculateSHA256:bundlePath];
    NSString *expectedSHA256 = [self extractSHA256FromASCFile:ascPath];
    
    if (!calculatedSHA256 || !expectedSHA256) {
        return NO;
    }
    
    BOOL isValid = [calculatedSHA256 isEqualToString:expectedSHA256];
    [self log:@"verifySignature" message:[NSString stringWithFormat:@"Calculated: %@, Expected: %@, Valid: %@", 
                                         calculatedSHA256, expectedSHA256, isValid ? @"YES" : @"NO"]];
    
    return isValid;
}

RCT_EXPORT_METHOD(downloadASC:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *downloadUrl = params[@"downloadUrl"];
    NSString *filePath = params[@"filePath"];
    
    if (!downloadUrl || !filePath) {
        reject(@"INVALID_PARAMS", @"downloadUrl and filePath are required", nil);
        return;
    }
    
    NSString *ascFileUrl = [downloadUrl stringByAppendingString:@".SHA256SUMS.asc"];
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    
    NSURL *url = [NSURL URLWithString:ascFileUrl];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request
                                                                 completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            [self sendDownloadError:error promise:reject];
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode != 200) {
            NSError *httpError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                     code:httpResponse.statusCode 
                                                 userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode]}];
            [self sendDownloadError:httpError promise:reject];
            return;
        }
        
        NSString *ascContent = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (!ascContent || ascContent.length == 0) {
            NSError *emptyError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                      code:-1 
                                                  userInfo:@{NSLocalizedDescriptionKey: @"Empty ASC file content"}];
            [self sendDownloadError:emptyError promise:reject];
            return;
        }
        
        [self log:@"downloadASC" message:ascContent];
        
        NSError *writeError;
        BOOL success = [ascContent writeToFile:ascFilePath 
                                    atomically:YES 
                                      encoding:NSUTF8StringEncoding 
                                         error:&writeError];
        
        if (!success) {
            [self sendDownloadError:writeError promise:reject];
            return;
        }
        
        resolve(nil);
    }];
    
    [task resume];
}

RCT_EXPORT_METHOD(verifyASC:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *filePath = params[@"filePath"];
    
    if (!filePath) {
        reject(@"INVALID_PARAMS", @"filePath is required", nil);
        return;
    }
    
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:ascFilePath]) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"ASC file not found"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    NSString *extractedSHA256 = [self extractSHA256FromASCFile:ascFilePath];
    if (!extractedSHA256 || extractedSHA256.length == 0) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Failed to extract SHA256 from ASC file"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    resolve(nil);
}

RCT_EXPORT_METHOD(verifyBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *filePath = params[@"filePath"];
    
    if (!filePath) {
        reject(@"INVALID_PARAMS", @"filePath is required", nil);
        return;
    }
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle file not found"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    BOOL isValid = [self verifyBundleSignature:filePath ascPath:ascFilePath];
    
    if (!isValid) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle signature verification failed"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    resolve(nil);
}

RCT_EXPORT_METHOD(downloadBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *downloadUrl = params[@"downloadUrl"];
    NSString *filePath = params[@"filePath"];
    NSString *notificationTitle = params[@"notificationTitle"] ?: @"Downloading Update";
    
    if (!downloadUrl || !filePath) {
        reject(@"INVALID_PARAMS", @"downloadUrl and filePath are required", nil);
        return;
    }
    
    // Remove existing file if it exists
    [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
    
    NSURL *url = [NSURL URLWithString:downloadUrl];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    
    [self sendEvent:@"update/start" params:nil];
    
    NSURLSessionDownloadTask *downloadTask = [[NSURLSession sharedSession] downloadTaskWithRequest:request
                                                                                  completionHandler:^(NSURL *location, NSURLResponse *response, NSError *error) {
        if (error) {
            [self sendDownloadError:error promise:reject];
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode != 200) {
            NSError *httpError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                     code:httpResponse.statusCode 
                                                 userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode]}];
            [self sendDownloadError:httpError promise:reject];
            return;
        }
        
        // Move downloaded file to target location
        NSError *moveError;
        [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
        BOOL success = [[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:filePath] error:&moveError];
        
        if (!success) {
            [self sendDownloadError:moveError promise:reject];
            return;
        }
        
        [self log:@"downloadBundle" message:@"Download completed"];
        [self sendEvent:@"update/downloaded" params:nil];
        
        resolve(nil);
    }];
    
    [downloadTask resume];
}

RCT_EXPORT_METHOD(installBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *filePath = params[@"filePath"];
    
    if (!filePath) {
        reject(@"INVALID_PARAMS", @"filePath is required", nil);
        return;
    }
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle file not found"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    // Verify bundle before installation
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    BOOL isValid = [self verifyBundleSignature:filePath ascPath:ascFilePath];
    
    if (!isValid) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle signature verification failed"}];
        [self sendDownloadError:error promise:reject];
        return;
    }
    
    // Copy bundle to app bundle location
    NSString *bundleName = @"main";
    NSString *bundleExtension = @"jsbundle";
    NSString *targetPath = [[NSBundle mainBundle] pathForResource:bundleName ofType:bundleExtension];
    
    if (!targetPath) {
        // If main.jsbundle doesn't exist, create it in the Documents directory
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        NSString *documentsDirectory = [paths objectAtIndex:0];
        targetPath = [documentsDirectory stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.%@", bundleName, bundleExtension]];
    }
    
    NSError *copyError;
    [[NSFileManager defaultManager] removeItemAtPath:targetPath error:nil];
    BOOL success = [[NSFileManager defaultManager] copyItemAtPath:filePath toPath:targetPath error:&copyError];
    
    if (!success) {
        [self sendDownloadError:copyError promise:reject];
        return;
    }
    
    [self log:@"installBundle" message:[NSString stringWithFormat:@"Bundle installed to: %@", targetPath]];
    
    resolve(nil);
}

RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    // Clear any cached files
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
    NSString *cachesDirectory = [paths objectAtIndex:0];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSArray *files = [fileManager contentsOfDirectoryAtPath:cachesDirectory error:nil];
    
    for (NSString *file in files) {
        if ([file hasPrefix:@"bundle_update_"]) {
            NSString *filePath = [cachesDirectory stringByAppendingPathComponent:file];
            [fileManager removeItemAtPath:filePath error:nil];
        }
    }
    
    resolve(nil);
}

@end
