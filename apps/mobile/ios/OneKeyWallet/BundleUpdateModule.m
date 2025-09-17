//
//  BundleUpdateModule.m
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//

#import "BundleUpdateModule.h"
#import <React/RCTLog.h>
#import <CocoaLumberjack/CocoaLumberjack.h>
#import <CommonCrypto/CommonDigest.h>
#import <React/RCTUtils.h>

static const DDLogLevel ddLogLevel = DDLogLevelVerbose;


@interface BundleUpdateModule ()
@property (nonatomic, assign) BOOL isDownloading;
@property (nonatomic, strong) NSURLSessionDownloadTask *downloadTask;
@property (nonatomic, strong) NSURLSession *urlSession;
@end

@implementation BundleUpdateModule

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        self.isDownloading = NO;
        
        // Create URL session with delegate for progress tracking
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        self.urlSession = [NSURLSession sessionWithConfiguration:config delegate:(id<NSURLSessionDelegate>)self delegateQueue:nil];
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"update/start", @"update/downloading", @"update/complete"];
}

+ (NSString *)downloadBundleDir {
    NSString *homeDir = NSHomeDirectory();
    NSString *bundleUpdateDir = [homeDir stringByAppendingPathComponent:@"onekey-bundle-download"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:bundleUpdateDir]) {
        [[NSFileManager defaultManager] createDirectoryAtPath:bundleUpdateDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return bundleUpdateDir;
}

+ (NSString *)bundleDir {
    NSString *homeDir = NSHomeDirectory();
    NSString *bundleDir = [homeDir stringByAppendingPathComponent:@"onekey-bundle"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:bundleDir]) {
        [[NSFileManager defaultManager] createDirectoryAtPath:bundleDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return bundleDir;
}

- (dispatch_queue_t)methodQueue {
    return dispatch_queue_create("com.onekey.bundleupdate", DISPATCH_QUEUE_SERIAL);
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
        DDLogDebug(@"extractSHA256: Error reading ASC file: %@", error.localizedDescription);
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

- (BOOL)verifyBundleSHA256:(NSString *)bundlePath sha256:(NSString *)sha256 {
    NSString *calculatedSHA256 = [self calculateSHA256:bundlePath];
    NSString *expectedSHA256 = sha256;
    
    if (!calculatedSHA256 || !expectedSHA256) {
        return NO;
    }
    
    BOOL isValid = [calculatedSHA256 isEqualToString:expectedSHA256];
    DDLogDebug(@"verifyBundleSHA256: Calculated: %@, Expected: %@, Valid: %@", calculatedSHA256, expectedSHA256, isValid ? @"YES" : @"NO");
    return isValid;
}

- (BOOL)verifyBundleSHA256:(NSString *)bundlePath ascPath:(NSString *)ascFilePath {
    NSString *extractedSHA256 = [self extractSHA256FromASCFile:ascFilePath];
    if (!extractedSHA256) {
        return NO;
    }
    
    return [self verifyBundleSHA256:bundlePath sha256:extractedSHA256];
}

#pragma mark - NSURLSessionDownloadDelegate

- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask
      didWriteData:(int64_t)bytesWritten
 totalBytesWritten:(int64_t)totalBytesWritten
totalBytesExpectedToWrite:(int64_t)totalBytesExpectedToWrite {
    
    if (totalBytesExpectedToWrite > 0) {
        double progress = (double)totalBytesWritten / (double)totalBytesExpectedToWrite;
        DDLogDebug(@"downloadBundle: progress: %f, bytesWritten: %lld, totalBytes: %lld", progress, totalBytesWritten, totalBytesExpectedToWrite);
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"update/downloading" body:@{
                @"progress": @(progress),
            }];
        });
    }
}

- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask
didFinishDownloadingToURL:(NSURL *)location {
    // This will be handled in the completion handler
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
            reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode != 200) {
            NSError *httpError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                     code:httpResponse.statusCode 
                                                 userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode]}];
            reject([NSString stringWithFormat:@"%ld", (long)httpError.code], httpError.localizedDescription, httpError);
            return;
        }
        
        NSString *ascContent = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (!ascContent || ascContent.length == 0) {
            NSError *emptyError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                      code:-1 
                                                  userInfo:@{NSLocalizedDescriptionKey: @"Empty ASC file content"}];
            reject([NSString stringWithFormat:@"%ld", (long)emptyError.code], emptyError.localizedDescription, emptyError);
            return;
        }
        
        DDLogDebug(@"downloadASC: ASC file content: %@", ascContent);
        
        NSError *writeError;
        BOOL success = [ascContent writeToFile:ascFilePath 
                                    atomically:YES 
                                      encoding:NSUTF8StringEncoding 
                                         error:&writeError];
        
        if (!success) {
            reject([NSString stringWithFormat:@"%ld", (long)writeError.code], writeError.localizedDescription, writeError);
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
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
        return;
    }
    
    NSString *extractedSHA256 = [self extractSHA256FromASCFile:ascFilePath];
    if (!extractedSHA256 || extractedSHA256.length == 0) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Failed to extract SHA256 from ASC file"}];
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
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
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
        return;
    }
    
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    BOOL isValid = [self verifyBundleSHA256:filePath ascPath:ascFilePath];
    
    if (!isValid) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle signature verification failed"}];
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
        return;
    }
    
    resolve(nil);
}

RCT_EXPORT_METHOD(downloadBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {

    if (self.isDownloading) {
        resolve(nil);
        return;
    }

    self.isDownloading = YES;

    NSString *appVersion = params[@"latestVersion"];
    NSString *bundleVersion = params[@"bundleVersion"];
    NSString *downloadUrl = params[@"downloadUrl"];
    NSNumber *fileSize = params[@"fileSize"];
    NSString *sha256 = params[@"sha256"];
    
    if (!downloadUrl || !fileSize || !sha256 || !appVersion || !bundleVersion) {
        self.isDownloading = NO;
        reject(@"INVALID_PARAMS", @"downloadUrl and fileSize and sha256 and appVersion and bundleVersion are required", nil);
        return;
    }
    
    NSString *fileName = [NSString stringWithFormat:@"%@-%@.zip", appVersion, bundleVersion];
    NSString *filePath = [BundleUpdateModule.downloadBundleDir stringByAppendingPathComponent:fileName];
    NSDictionary *result = @{
        @"downloadedFile": filePath,
        @"downloadUrl": downloadUrl,
        @"latestVersion": appVersion,
        @"bundleVersion": bundleVersion
    };

    DDLogDebug(@"downloadBundle: filePath: %@", filePath);
    if ([[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
        if ([self verifyBundleSHA256:filePath sha256:sha256]) {
            resolve(result);
            self.isDownloading = NO;
            return;
        } else {
            [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
        }
    }
    
    NSURL *url = [NSURL URLWithString:downloadUrl];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    
    // Check if partial file exists and get its size
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *partialFilePath = [filePath stringByAppendingString:@".partial"];
    long long downloadedBytes = 0;
    
    if ([fileManager fileExistsAtPath:partialFilePath]) {
        NSDictionary *fileAttributes = [fileManager attributesOfItemAtPath:partialFilePath error:nil];
        downloadedBytes = [fileAttributes fileSize];
    }
    
    // Create request with Range header if resuming
    NSMutableURLRequest *mutableRequest = [request mutableCopy];
    if (downloadedBytes > 0) {
        [mutableRequest setValue:[NSString stringWithFormat:@"bytes=%lld-", downloadedBytes] forHTTPHeaderField:@"Range"];
    }
    
    self.downloadTask = [self.urlSession downloadTaskWithRequest:mutableRequest
                                                completionHandler:^(NSURL *location, NSURLResponse *response, NSError *error) {
        if (error) {
            self.isDownloading = NO;
            reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode != 200 && httpResponse.statusCode != 206) {
            NSError *httpError = [NSError errorWithDomain:@"BundleUpdateError" 
                                                   code:httpResponse.statusCode 
                                               userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode]}];
            self.isDownloading = NO;
            reject([NSString stringWithFormat:@"%ld", (long)httpError.code], httpError.localizedDescription, httpError);
            return;
        }
        
        // Move downloaded file to target location
        NSError *moveError;
        [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
        BOOL success = [[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:filePath] error:&moveError];
        
        if (!success) {
            self.isDownloading = NO;
            reject([NSString stringWithFormat:@"%ld", (long)moveError.code], moveError.localizedDescription, moveError);
            return;
        }

        self.isDownloading = NO;
        [[NSFileManager defaultManager] removeItemAtPath:partialFilePath error:nil];

        if (![self verifyBundleSHA256:filePath sha256:sha256]) {
            [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
            reject(@"INVALID_PARAMS", @"Bundle signature verification failed", nil);
            return;
        }
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"update/complete" body:result];
        });
        
        DDLogDebug(@"downloadBundle: Download completed");
        resolve(result);
    }];
    
    [self sendEventWithName:@"update/start" body:nil];
    [self.downloadTask resume];
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
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
        return;
    }
    
    // Verify bundle before installation
    NSString *ascFilePath = [filePath stringByAppendingString:@".SHA256SUMS.asc"];
    BOOL isValid = [self verifyBundleSHA256:filePath ascPath:ascFilePath];
    
    if (!isValid) {
        NSError *error = [NSError errorWithDomain:@"BundleUpdateError" 
                                             code:-1 
                                         userInfo:@{NSLocalizedDescriptionKey: @"Bundle signature verification failed"}];
        reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
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
        reject([NSString stringWithFormat:@"%ld", (long)copyError.code], copyError.localizedDescription, copyError);
        return;
    }
    
    DDLogDebug(@"installBundle: Bundle installed to: %@", targetPath);
    
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
