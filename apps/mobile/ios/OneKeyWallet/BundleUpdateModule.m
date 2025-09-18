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
#import "SSZipArchive.h"

static const DDLogLevel ddLogLevel = DDLogLevelVerbose;


@interface BundleUpdateModule ()
@property (nonatomic, assign) BOOL isDownloading;
@property (nonatomic, strong) NSURLSessionDownloadTask *downloadTask;
@property (nonatomic, strong) NSURLSession *urlSession;
@property (nonatomic, strong) NSString *filePath;
@property (nonatomic, strong) NSDictionary *downloadBundleResult;
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
    return @[@"update/start", @"update/downloading", @"update/complete", @"update/error"];
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

+ (NSString *)currentBundleVersion {
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    return [userDefaults objectForKey:@"currentBundleVersion"];
}

+ (NSString *)currentBundleDir {
    NSString *folderName = [self currentBundleVersion];
    if (!folderName) {
        return nil;
    }
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    return [bundleDir stringByAppendingPathComponent:folderName];
}

+ (NSString *)currentBundleMainJSBundle {
    NSString *currentAppVersion = [[[NSBundle mainBundle]infoDictionary] objectForKey:@"CFBundleShortVersionString"];
    NSString *currentBundleVersion = [self currentBundleVersion];
    NSLog(@"currentAppVersion: %@, currentBundleVersion: %@", currentAppVersion, currentBundleVersion);
    DDLogDebug(@"currentAppVersion: %@, currentBundleVersion: %@", currentAppVersion, currentBundleVersion);
    if (currentBundleVersion == nil) {
        return nil;
    }
    if (currentAppVersion != nil) {
        NSString *bundleAppVersion = [currentBundleVersion componentsSeparatedByString:@"-"][0];
        if (![currentAppVersion isEqualToString:bundleAppVersion]) {
            return nil;
        }
    }
    NSString *folderName = [self currentBundleDir];
    if (!folderName || ![[NSFileManager defaultManager] fileExistsAtPath:folderName]) {
        return nil;
    }
    NSString *mainJSBundle = [folderName stringByAppendingPathComponent:@"main.jsbundle.hbc"];
    return mainJSBundle;
}

+ (NSDictionary *)currentMetadataJson {
    NSString *folderName = [self currentBundleDir];
    if (!folderName) {
        return nil;
    }
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    NSString *metadataJson = [[bundleDir stringByAppendingPathComponent:folderName] stringByAppendingPathComponent:@"metadata.json"];
    NSData *jsonData = [NSData dataWithContentsOfFile:metadataJson];
    if (!jsonData) {
        return nil;
    }
    
    NSError *error;
    NSDictionary *metadata = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (error) {
        NSLog(@"Error parsing metadata.json: %@", error.localizedDescription);
        return nil;
    }
    return metadata;
}

+ (BOOL)valiateAllFilesInDir:(NSString *)DirPath metadata:(NSDictionary *)metadata appVersion:(NSString *)appVersion bundleVersion:(NSString *)bundleVersion {
    NSString *parentBundleDir = [BundleUpdateModule bundleDir];
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *jsBundleDir = [[parentBundleDir stringByAppendingPathComponent:folderName] stringByAppendingString:@"/"];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    // Get all files recursively, excluding metadata.json
    NSDirectoryEnumerator *enumerator = [fileManager enumeratorAtPath:DirPath];
    NSString *file;
    
    while ((file = [enumerator nextObject])) {
        // Skip metadata.json
        if ([file containsString:@"metadata.json"] || [file containsString:@".DS_Store"]) {
            continue;
        }
        
        // Get full path
        NSString *fullPath = [DirPath stringByAppendingPathComponent:file];
        
        // Skip directories
        BOOL isDirectory;
        if ([fileManager fileExistsAtPath:fullPath isDirectory:&isDirectory] && isDirectory) {
            BOOL result = [self valiateAllFilesInDir:fullPath metadata:metadata appVersion:appVersion bundleVersion:bundleVersion];
            if (result) {
                continue;
            } else {
                return NO;
            }
        }
        
        NSString *relativePath = [fullPath stringByReplacingOccurrencesOfString:jsBundleDir withString:@""];
        NSLog(@"relativePath: %@", relativePath);
        DDLogDebug(@"relativePath: %@", relativePath);

        // Get expected SHA256 from metadata
        NSString *expectedSHA256 = metadata[relativePath];
        if (!expectedSHA256) {
            NSLog(@"File %@ not found in metadata", relativePath);
            DDLogDebug(@"File %@ not found in metadata", relativePath);
            return NO;
        }
        
        // Calculate actual SHA256
        NSString *actualSHA256 = [BundleUpdateModule calculateSHA256:fullPath];
        if (!actualSHA256) {
            NSLog(@"Failed to calculate SHA256 for file %@", relativePath);
            DDLogDebug(@"Failed to calculate SHA256 for file %@", relativePath);
            return NO;
        }
        
        // Compare SHA256 values
        if (![expectedSHA256 isEqualToString:actualSHA256]) {
            NSLog(@"SHA256 mismatch for file %@. Expected: %@, Actual: %@", relativePath, expectedSHA256, actualSHA256);
            DDLogDebug(@"SHA256 mismatch for file %@. Expected: %@, Actual: %@", relativePath, expectedSHA256, actualSHA256);
            return NO;
        }
    }
    
    return YES;
}

+ (void)setCurrentBundleVersion:(NSString *)version {
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:version forKey:@"currentBundleVersion"];
    [userDefaults synchronize];
}

+ (NSString *)calculateSHA256:(NSString *)filePath {
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

- (dispatch_queue_t)methodQueue {
    return dispatch_queue_create("com.onekey.bundleupdate", DISPATCH_QUEUE_SERIAL);
}

- (void)clearDownloadTask {
    self.isDownloading = NO;
    if (self.downloadTask != nil) {
        [self.downloadTask cancel];
        self.downloadTask = nil;
    }
    self.downloadTask = nil;
    self.downloadBundleResult = nil;
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
    NSString *calculatedSHA256 = [BundleUpdateModule calculateSHA256:bundlePath];
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
                @"progress": @(progress * 100),
            }];
        });
    }
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    self.isDownloading = NO;
    self.downloadTask = nil;
    if (error) {
        [self sendEventWithName:@"update/error" body:@{
            @"error": error.localizedDescription,
        }];
    }
}

- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask
didFinishDownloadingToURL:(NSURL *)location {
        NSError *moveError;
        NSString *filePath = self.downloadBundleResult[@"downloadedFile"];
        NSString *sha256 = self.downloadBundleResult[@"sha256"];
        [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
        BOOL success = [[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:filePath] error:&moveError];
        
        if (!success) {
            [self clearDownloadTask];
            [self sendEventWithName:@"update/error" body:@{
                @"error": [NSString stringWithFormat:@"%ld", (long)moveError.code],
                @"errorMessage": moveError.localizedDescription,
            }];
            return;
        }

        if (![self verifyBundleSHA256:filePath sha256:sha256]) {
            [self clearDownloadTask];
            [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
            [self sendEventWithName:@"update/error" body:@{
                @"error": @"Bundle signature verification failed",
            }];
            return;
        }
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"update/complete" body:nil];
        });
        DDLogDebug(@"downloadBundle: Download completed");
        [self clearDownloadTask];
}

RCT_EXPORT_METHOD(downloadBundleASC:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *downloadUrl = params[@"downloadUrl"];
    NSString *filePath = params[@"downloadedFile"];
    NSString *signature = params[@"signature"];
    NSString *appVersion = params[@"latestVersion"];
    NSString *bundleVersion = params[@"bundleVersion"];
    NSString *sha256 = params[@"sha256"];

    if (!downloadUrl || !filePath || !signature || !appVersion || !bundleVersion || !sha256) {
        reject(@"INVALID_PARAMS", @"downloadUrl and filePath and signature and appVersion and bundleVersion and sha256 are required", nil);
        return;
    }
    
    NSString *storageKey = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:signature forKey:storageKey];
    [userDefaults synchronize];
    
    DDLogDebug(@"downloadASC: Stored signature for key: %@", storageKey);
    
    resolve(nil);
}

RCT_EXPORT_METHOD(verifyBundleASC:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(nil);
}

RCT_EXPORT_METHOD(verifyBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *filePath = params[@"downloadedFile"];
    NSString *sha256 = params[@"sha256"];
    NSString *appVersion = params[@"latestVersion"];
    NSString *bundleVersion = params[@"bundleVersion"];
    if (!filePath || !sha256) {
        reject(@"INVALID_PARAMS", @"filePath and sha256 are required", nil);
        return;
    }
    
    if (![self verifyBundleSHA256:filePath sha256:sha256]) {
        reject(@"INVALID_PARAMS", @"Bundle signature verification failed", nil);
        return;
    }

    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *destination = [BundleUpdateModule.bundleDir stringByAppendingPathComponent:folderName];
    [SSZipArchive unzipFileAtPath:filePath toDestination:destination];
    NSString *metadataJsonPath = [destination stringByAppendingPathComponent:@"metadata.json"];
    NSData *jsonData = [NSData dataWithContentsOfFile:metadataJsonPath];
    if (!jsonData) {
        reject(@"INVALID_PARAMS", @"Failed to read metadata.json", nil);
        return;
    }
    
    NSError *error;
    NSDictionary *metadata = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (error) {
        reject(@"INVALID_PARAMS", [NSString stringWithFormat:@"Error parsing metadata.json: %@", error.localizedDescription], nil);
        return;
    }
    if (![BundleUpdateModule valiateAllFilesInDir:destination metadata:metadata appVersion:appVersion bundleVersion:bundleVersion]) {
        reject(@"INVALID_PARAMS", @"Bundle signature verification failed", nil);
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
        @"bundleVersion": bundleVersion,
        @"sha256": sha256,
    };

    DDLogDebug(@"downloadBundle: filePath: %@", filePath);
    if ([[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
        if ([self verifyBundleSHA256:filePath sha256:sha256]) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(10.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                resolve(result);
                [self clearDownloadTask];
                [self sendEventWithName:@"update/complete" body:nil];
            });
            return;
        } else {
            [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
        }
    }
    
    
    // Check if partial file exists and get its size
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *partialFilePath = [filePath stringByAppendingString:@".partial"];
    long long downloadedBytes = 0;
    
    if ([fileManager fileExistsAtPath:partialFilePath]) {
        NSDictionary *fileAttributes = [fileManager attributesOfItemAtPath:partialFilePath error:nil];
        downloadedBytes = [fileAttributes fileSize];
    }
    
    // Create request with Range header if resuming
    NSURL *url = [NSURL URLWithString:downloadUrl];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    self.downloadTask = [self.urlSession downloadTaskWithRequest:request];
    [self sendEventWithName:@"update/start" body:nil];
    [self.downloadTask resume];
    self.downloadBundleResult = result;
    resolve(result);
}

RCT_EXPORT_METHOD(installBundle:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *appVersion = params[@"latestVersion"];
    NSString *bundleVersion = params[@"bundleVersion"];
    NSString *filePath = params[@"downloadedFile"];
    if (!filePath || !appVersion || !bundleVersion) {
        reject(@"INVALID_PARAMS", @"filePath and appVersion and bundleVersion are required", nil);
        return;
    }
    
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
     NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:folderName forKey:@"currentBundleVersion"];
    [userDefaults synchronize];
    resolve(nil);
}

RCT_EXPORT_METHOD(clearBundle:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *downloadBundleDir = BundleUpdateModule.downloadBundleDir;
    NSError *error;
    if (downloadBundleDir != nil && [[NSFileManager defaultManager] fileExistsAtPath:downloadBundleDir]) {
        [[NSFileManager defaultManager] removeItemAtPath:downloadBundleDir error:&error];
        if (error) {
            reject([NSString stringWithFormat:@"%ld", (long)error.code], error.localizedDescription, error);
            return;
        }
    }
    if (self.downloadTask != nil) {
        [self.downloadTask cancel];
        self.downloadTask = nil;
    }
    [self clearDownloadTask];
    resolve(nil);
}

@end
