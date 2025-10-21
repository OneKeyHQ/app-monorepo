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
#import "Verification.h"

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

+ (NSString *)documentDirectory {
    return [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory,NSUserDomainMask, YES) objectAtIndex:0];
}

+ (NSString *)downloadBundleDir {
    NSString *documentDirectory = [BundleUpdateModule documentDirectory];
    NSString *bundleUpdateDir = [documentDirectory stringByAppendingPathComponent:@"onekey-bundle-download"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:bundleUpdateDir]) {
        [[NSFileManager defaultManager] createDirectoryAtPath:bundleUpdateDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return bundleUpdateDir;
}

+ (NSString *)bundleDir {
    NSString *documentDirectory = [BundleUpdateModule documentDirectory];
    NSString *bundleDir = [documentDirectory stringByAppendingPathComponent:@"onekey-bundle"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:bundleDir]) {
        [[NSFileManager defaultManager] createDirectoryAtPath:bundleDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return bundleDir;
}

+ (NSString *)setNativeVersion:(NSString *)nativeVersion {
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:nativeVersion forKey:@"nativeVersion"];
    [userDefaults synchronize];
    return nativeVersion;
}

+ (NSString *)getNativeVersion {
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    return [userDefaults objectForKey:@"nativeVersion"];
}

+ (NSString *)currentBundleVersion {
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    NSString *currentBundleVersion = [userDefaults objectForKey:@"currentBundleVersion"];
    DDLogDebug(@"currentBundleVersion: %@", currentBundleVersion);
    return currentBundleVersion;
}

+ (NSString *)currentBundleDir {
    NSString *folderName = [self currentBundleVersion];
    if (!folderName) {
        return nil;
    }
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    return [bundleDir stringByAppendingPathComponent:folderName];
}

+ (NSString *)getWebEmbedPath {
    NSString *currentBundleDir = [BundleUpdateModule currentBundleDir];
    if (currentBundleDir == nil) {
        return @"";
    }
    NSString *webEmbedPath = [currentBundleDir stringByAppendingPathComponent:@"web-embed"];
    return webEmbedPath;
}

+ (void)clearUpdateBundleData {
    // Clear bundle directory
    NSString *bundleDir = [self bundleDir];
    if ([[NSFileManager defaultManager] fileExistsAtPath:bundleDir]) {
        NSError *error;
        [[NSFileManager defaultManager] removeItemAtPath:bundleDir error:&error];
        if (error) {
            DDLogError(@"Failed to remove bundle directory: %@", error.localizedDescription);
        }
    }
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    NSString *currentBundleVersion = [self currentBundleVersion];
    if (currentBundleVersion) {
        [userDefaults removeObjectForKey:currentBundleVersion];
    }
    [userDefaults removeObjectForKey:@"currentBundleVersion"];
    [userDefaults synchronize];
}

+ (NSComparisonResult)compareVersion:(NSString *)version1 withVersion:(NSString *)version2 {
    if (!version1 || !version2) {
        if (!version1 && !version2) return NSOrderedSame;
        if (!version1) return NSOrderedAscending;
        return NSOrderedDescending;
    }
    
    NSArray *components1 = [version1 componentsSeparatedByString:@"."];
    NSArray *components2 = [version2 componentsSeparatedByString:@"."];
    
    NSInteger maxCount = MAX(components1.count, components2.count);
    
    for (NSInteger i = 0; i < maxCount; i++) {
        NSInteger value1 = 0;
        NSInteger value2 = 0;
        
        if (i < components1.count) {
            value1 = [components1[i] integerValue];
        }
        
        if (i < components2.count) {
            value2 = [components2[i] integerValue];
        }
        
        if (value1 < value2) {
            return NSOrderedAscending;
        } else if (value1 > value2) {
            return NSOrderedDescending;
        }
    }
    
    return NSOrderedSame;
}

+ (NSString *)getCurrentNativeVersion {
    return [[[NSBundle mainBundle]infoDictionary] objectForKey:@"CFBundleShortVersionString"];
}

+ (NSString *)currentBundleMainJSBundle {
    NSString *currentBundleVersion = [self currentBundleVersion];
    if (currentBundleVersion == nil) {
        return nil;
    }

    NSString *currentAppVersion = [self getCurrentNativeVersion];
    NSString *prevNativeVersion = [self getNativeVersion];
    if (prevNativeVersion == nil) {
        return nil;
    }
    if (![currentAppVersion isEqualToString: prevNativeVersion]) {
        DDLogDebug(@"currentAppVersion is not equal to prevNativeVersion %@ %@", currentAppVersion, prevNativeVersion);
        // Clear all bundle-related preferences
        NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
        NSString *currentBundleVersion = [userDefaults stringForKey:@"currentBundleVersion"];
        if (currentBundleVersion) {
            [userDefaults removeObjectForKey:currentBundleVersion];
            [userDefaults removeObjectForKey:@"currentBundleVersion"];
        }
        [userDefaults synchronize];
        DDLogDebug(@"Cleared all bundle-related preferences");
       return nil;
    }
    NSString *folderName = [self currentBundleDir];
    if (!folderName || ![[NSFileManager defaultManager] fileExistsAtPath:folderName]) {
        DDLogDebug(@"currentBundleDir does not exist");
        return nil;
    }
    
    // Get signature from UserDefaults
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    NSString *signature = [userDefaults objectForKey:currentBundleVersion];
    DDLogDebug(@"Retrieved signature for key: %@, signature: %@", currentBundleVersion, signature);
    
    // Validate metadata file SHA256
    if (![self validateMetadataFileSha256:currentBundleVersion signature:signature]) {
        return nil;
    }
    
    // Get metadata content and validate main bundle
    NSDictionary *metadata = [self getMetadataFileContent:currentBundleVersion];
    if (!metadata) {
        return nil;
    }
    NSString *manJsBundleName = @"main.jsbundle.hbc";
    NSString *mainJSBundle = [folderName stringByAppendingPathComponent:manJsBundleName];
    DDLogDebug(@"mainJSBundle path: %@", mainJSBundle);
    if (![[NSFileManager defaultManager] fileExistsAtPath:mainJSBundle]) {
        DDLogDebug(@"mainJSBundleFile does not exist");
        return nil;
    }
    
    // Validate main bundle SHA256
    NSString *expectedSha256 = metadata[manJsBundleName];
    NSString *calculatedSha256 = [self calculateSHA256:mainJSBundle];
    DDLogDebug(@"calculatedSha256: %@, sha256: %@", calculatedSha256, expectedSha256);
    
    if (!calculatedSha256 || !expectedSha256 || ![calculatedSha256 isEqualToString:expectedSha256]) {
        return nil;
    }
    
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

+ (NSString *)getMetadataFilePath:(NSString *)currentBundleVersion {
    if (!currentBundleVersion) {
        return nil;
    }
    NSString *bundleDir = [self bundleDir];
    NSString *metadataPath = [[bundleDir stringByAppendingPathComponent:currentBundleVersion] stringByAppendingPathComponent:@"metadata.json"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:metadataPath]) {
        return nil;
    }
    return metadataPath;
}

+ (NSDictionary *)getMetadataFileContent:(NSString *)currentBundleVersion {
    NSString *metadataFilePath = [self getMetadataFilePath:currentBundleVersion];
    if (!metadataFilePath) {
        return nil;
    }
    
    NSData *jsonData = [NSData dataWithContentsOfFile:metadataFilePath];
    if (!jsonData) {
        return nil;
    }
    
    NSError *error;
    NSDictionary *metadata = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (error) {
        DDLogDebug(@"Error parsing metadata.json: %@", error.localizedDescription);
        return nil;
    }
    return metadata;
}

+ (NSString *)readMetadataFileSha256:(NSString *)signature {
    if (!signature) {
        return nil;
    }
    
    NSError *error;
    NSString *textContent = [Verification extractedTextContentFromVerifyAscFile:signature error:&error];
    
    if (error || textContent == nil) {
        DDLogDebug(@"Error extracting SHA256 from signature: %@", error.localizedDescription);
        return nil;
    }

    // Parse the extracted content as JSON to get the SHA256
    if (!textContent || textContent.length == 0) {
        return nil;
    }
    
    NSData *jsonData = [textContent dataUsingEncoding:NSUTF8StringEncoding];
    if (!jsonData) {
        DDLogDebug(@"Failed to convert extracted content to JSON data");
        return nil;
    }
    
    NSError *jsonError;
    NSDictionary *jsonObject = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&jsonError];
    if (jsonError) {
        DDLogDebug(@"Error parsing extracted content as JSON: %@", jsonError.localizedDescription);
        return nil;
    }
    
    NSString *extractedSha256 = jsonObject[@"sha256"];
    if (!extractedSha256) {
        DDLogDebug(@"SHA256 field not found in extracted JSON content");
        return nil;
    }

    DDLogDebug(@"extractedSha256: %@", extractedSha256);
    return extractedSha256;
}

+ (NSString *)getFallbackUpdateBundleDataPath { 
    NSString *bundleDir = [self bundleDir];
    NSString *fallbackUpdateBundleDataPath = [bundleDir stringByAppendingPathComponent:@"fallbackUpdateBundleData.json"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:fallbackUpdateBundleDataPath]) {
        [[NSFileManager defaultManager] createFileAtPath:fallbackUpdateBundleDataPath contents:nil attributes:nil];
    }
    return fallbackUpdateBundleDataPath;
}

+ (void)writeFallbackUpdateBundleDataFile:(NSArray *)fallbackUpdateBundleData { 
    NSString *fallbackUpdateBundleDataPath = [self getFallbackUpdateBundleDataPath];
    NSError *writeError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:fallbackUpdateBundleData options:0 error:&writeError];
    if (writeError) {
        DDLogError(@"Failed to write fallback update bundle data file: %@", writeError.localizedDescription);
        return;
    }
    NSString *fallbackUpdateBundleDataString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    BOOL success = [fallbackUpdateBundleDataString writeToFile:fallbackUpdateBundleDataPath 
                                                    atomically:YES 
                                                      encoding:NSUTF8StringEncoding 
                                                         error:&writeError];
    if (!success) {
        DDLogError(@"Failed to write fallback update bundle data file: %@", writeError.localizedDescription);
    }
}

+ (NSArray *)readFallbackUpdateBundleDataFile { 
   NSString *fallbackUpdateBundleDataPath = [self getFallbackUpdateBundleDataPath];
   NSString *fallbackUpdateBundleDataString = [NSString stringWithContentsOfFile:fallbackUpdateBundleDataPath encoding:NSUTF8StringEncoding error:nil];
   if (!fallbackUpdateBundleDataString || [fallbackUpdateBundleDataString isEqualToString:@""] || fallbackUpdateBundleDataString == nil) {
       return [[NSArray alloc] init];
   }
   NSError *error;
   NSData *jsonData = [fallbackUpdateBundleDataString dataUsingEncoding:NSUTF8StringEncoding];
   NSArray *fallbackUpdateBundleData = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
   if (error) {
       DDLogError(@"Failed to read fallback update bundle data file: %@", error.localizedDescription);
       return nil;
   }
   return fallbackUpdateBundleData;
}


+ (BOOL)validateMetadataFileSha256:(NSString *)currentBundleVersion signature:(NSString *)signature {
    NSString *metadataFilePath = [self getMetadataFilePath:currentBundleVersion];
    if (!metadataFilePath) {
        DDLogDebug(@"metadataFilePath is null");
        return NO;
    }
    
    NSString *extractedSha256 = [self readMetadataFileSha256:signature];
    if (!extractedSha256 || extractedSha256.length == 0) {
        return NO;
    }
    
    NSString *calculatedSha256 = [self calculateSHA256:metadataFilePath];
    return [calculatedSha256 isEqualToString:extractedSha256];
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
        DDLogDebug(@"downloadBundle: error: %@", error.localizedDescription);
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
        NSString *downloadDir = [BundleUpdateModule downloadBundleDir];
        BOOL isExist = [[NSFileManager defaultManager] fileExistsAtPath:downloadDir];
        DDLogDebug(@"downloadBundle: downloadDir path: %@", downloadDir);
        DDLogDebug(@"downloadBundle: isExist: %@", isExist ? @"YES" : @"NO");
        DDLogDebug(@"downloadBundle: location.path: %@", location.path);
        DDLogDebug(@"downloadBundle: filePath: %@", filePath);
        DDLogDebug(@"downloadBundle: Attempting to move file from %@ to %@", location.path, filePath);
        
        // Check if source file exists
        BOOL sourceExists = [[NSFileManager defaultManager] fileExistsAtPath:location.path];
        DDLogDebug(@"downloadBundle: Source file exists: %@", sourceExists ? @"YES" : @"NO");
        
        // Check if destination directory exists, create if needed
        NSString *destinationDir = [filePath stringByDeletingLastPathComponent];
        BOOL destDirExists = [[NSFileManager defaultManager] fileExistsAtPath:destinationDir];
        DDLogDebug(@"downloadBundle: destinationDir path: %@", destinationDir);
        DDLogDebug(@"downloadBundle: Destination directory exists: %@", destDirExists ? @"YES" : @"NO");
        
        if (!destDirExists) {
            NSError *createDirError;
            BOOL createSuccess = [[NSFileManager defaultManager] createDirectoryAtPath:destinationDir withIntermediateDirectories:YES attributes:nil error:&createDirError];
            DDLogDebug(@"downloadBundle: Create directory success: %@, error: %@", createSuccess ? @"YES" : @"NO", createDirError.localizedDescription);
        }
        // Check if destination file already exists and remove it
        BOOL destFileExists = [[NSFileManager defaultManager] fileExistsAtPath:filePath];
        if (destFileExists) {
            NSError *removeError;
            BOOL removeSuccess = [[NSFileManager defaultManager] removeItemAtPath:filePath error:&removeError];
            DDLogDebug(@"downloadBundle: Removed existing destination file: %@, error: %@", removeSuccess ? @"YES" : @"NO", removeError.localizedDescription);
        }
        
        BOOL success = [[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:filePath] error:&moveError];
        DDLogDebug(@"downloadBundle: success: %@, moveError: %@", success ? @"YES" : @"NO");
        if (!success) {
            [self clearDownloadTask];
            DDLogDebug(@"downloadBundle: error: %@", moveError.localizedDescription);
            [self sendEventWithName:@"update/error" body:@{
                @"error": [NSString stringWithFormat:@"%ld", (long)moveError.code],
                @"errorMessage": moveError.localizedDescription,
            }];
            return;
        }

        if (![self verifyBundleSHA256:filePath sha256:sha256]) {
            [self clearDownloadTask];
            [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
            DDLogDebug(@"downloadBundle: error: Bundle signature verification failed");
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
    NSString *filePath = params[@"downloadedFile"];
    NSString *sha256 = params[@"sha256"];
    NSString *appVersion = params[@"latestVersion"];
    NSString *bundleVersion = params[@"bundleVersion"];
    NSString *signature = params[@"signature"];
    
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
    
    // Unzip the bundle
    [SSZipArchive unzipFileAtPath:filePath toDestination:destination];
    
    NSString *metadataJsonPath = [destination stringByAppendingPathComponent:@"metadata.json"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:metadataJsonPath]) {
        reject(@"INVALID_PARAMS", @"Failed to read metadata.json", nil);
        return;
    }
    
    // Validate metadata file SHA256
    NSString *currentBundleVersion = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    if (![BundleUpdateModule validateMetadataFileSha256:currentBundleVersion signature:signature]) {
        reject(@"INVALID_PARAMS", @"Bundle signature verification failed", nil);
        return;
    }
    
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
    
    NSString *metadataJsonPath = [destination stringByAppendingPathComponent:@"metadata.json"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:metadataJsonPath]) {
        reject(@"INVALID_PARAMS", @"Failed to read metadata.json", nil);
        return;
    }
    
    // Read and parse metadata.json
    NSData *jsonData = [NSData dataWithContentsOfFile:metadataJsonPath];
    NSError *error;
    NSDictionary *metadata = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (error) {
        reject(@"INVALID_PARAMS", [NSString stringWithFormat:@"Error parsing metadata.json: %@", error.localizedDescription], nil);
        return;
    }
    
    // Validate all files in the directory
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

    NSString *currentFolderName = [BundleUpdateModule currentBundleVersion];
    
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
     NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:folderName forKey:@"currentBundleVersion"];
    NSString *currentNativeVersion = [BundleUpdateModule getCurrentNativeVersion];
    [userDefaults setObject:currentNativeVersion forKey:@"nativeVersion"];
    [userDefaults synchronize];

    NSMutableArray *fallbackUpdateBundleData = [[BundleUpdateModule readFallbackUpdateBundleDataFile] mutableCopy];
    if (!fallbackUpdateBundleData) {
        fallbackUpdateBundleData = [NSMutableArray array];
    }

    if (currentFolderName) {
        NSArray *currentFolderData = [currentFolderName componentsSeparatedByString:@"-"];
        NSString *currentAppVersion = currentFolderData[0];
        NSString *currentBundleVersion = currentFolderData[1];
        NSString *currentSignature = [userDefaults objectForKey:currentFolderName];
        [fallbackUpdateBundleData addObject:@{
            @"appVersion": currentAppVersion,
            @"bundleVersion": currentBundleVersion,
            @"signature": currentSignature,
        }];
    }

    // If fallbackUpdateBundleData has more than 3 items, remove the first one and delete corresponding folder
    if (fallbackUpdateBundleData.count > 3) {
        NSDictionary *shiftUpdateBundleData = [fallbackUpdateBundleData firstObject];
        [fallbackUpdateBundleData removeObjectAtIndex:0];
        
        if (shiftUpdateBundleData) {

            NSString *shiftAppVersion = shiftUpdateBundleData[@"appVersion"];
            NSString *shiftBundleVersion = shiftUpdateBundleData[@"bundleVersion"];
            if (shiftAppVersion && shiftBundleVersion) {
                NSString *dirName = [NSString stringWithFormat:@"%@-%@", shiftAppVersion, shiftBundleVersion];
                // Remove signature for the old bundle
                [userDefaults removeObjectForKey:dirName];
                NSString *bundleDir = [BundleUpdateModule bundleDir];
                NSString *bundleDirPath = [bundleDir stringByAppendingPathComponent:dirName];
                
                if ([[NSFileManager defaultManager] fileExistsAtPath:bundleDirPath]) {
                    NSError *removeError;
                    [[NSFileManager defaultManager] removeItemAtPath:bundleDirPath error:&removeError];
                    if (removeError) {
                        DDLogError(@"Failed to remove old bundle directory: %@", removeError.localizedDescription);
                    }
                }
            }
        }
    }

   [BundleUpdateModule writeFallbackUpdateBundleDataFile:fallbackUpdateBundleData];
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

RCT_EXPORT_METHOD(getWebEmbedPathAsync:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *webEmbedPath = [BundleUpdateModule getWebEmbedPath];
    DDLogDebug(@"getWebEmbedPathAsync: webEmbedPath: %@", webEmbedPath);
    resolve(webEmbedPath);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getWebEmbedPath) {
    NSString *webEmbedPath = [BundleUpdateModule getWebEmbedPath];
    DDLogDebug(@"getWebEmbedPath: webEmbedPath: %@", webEmbedPath);
    return webEmbedPath;
}

RCT_EXPORT_METHOD(testVerification:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL result = [Verification testExtractedSha256FromVerifyAscFile];
    resolve(@(result));
}

RCT_EXPORT_METHOD(testDeleteJsBundle:(NSString *)appVersion
                  bundleVersion:(NSString *)bundleVersion
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    NSString *jsBundlePath = [[bundleDir stringByAppendingPathComponent:folderName] stringByAppendingPathComponent:@"main.jsbundle.hbc"];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:jsBundlePath]) {
        NSError *error;
        BOOL success = [fileManager removeItemAtPath:jsBundlePath error:&error];
        if (success) {
            DDLogDebug(@"testDeleteJsBundle: Deleted jsBundle: %@", jsBundlePath);
            resolve(@{@"success": @YES, @"message": [NSString stringWithFormat:@"Deleted jsBundle: %@", jsBundlePath]});
        } else {
            DDLogDebug(@"testDeleteJsBundle: Error deleting jsBundle: %@", error.localizedDescription);
            reject(@"DELETE_ERROR", error.localizedDescription, error);
        }
    } else {
        DDLogDebug(@"testDeleteJsBundle: jsBundle not found: %@", jsBundlePath);
        resolve(@{@"success": @NO, @"message": [NSString stringWithFormat:@"jsBundle not found: %@", jsBundlePath]});
    }
}

RCT_EXPORT_METHOD(testDeleteJsRuntimeDir:(NSString *)appVersion
                  bundleVersion:(NSString *)bundleVersion
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    NSString *jsRuntimeDir = [bundleDir stringByAppendingPathComponent:folderName];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:jsRuntimeDir]) {
        NSError *error;
        BOOL success = [fileManager removeItemAtPath:jsRuntimeDir error:&error];
        if (success) {
            DDLogDebug(@"testDeleteJsRuntimeDir: Deleted js runtime directory: %@", jsRuntimeDir);
            resolve(@{@"success": @YES, @"message": [NSString stringWithFormat:@"Deleted js runtime directory: %@", jsRuntimeDir]});
        } else {
            DDLogDebug(@"testDeleteJsRuntimeDir: Error deleting js runtime directory: %@", error.localizedDescription);
            reject(@"DELETE_ERROR", error.localizedDescription, error);
        }
    } else {
        DDLogDebug(@"testDeleteJsRuntimeDir: js runtime directory not found: %@", jsRuntimeDir);
        resolve(@{@"success": @NO, @"message": [NSString stringWithFormat:@"js runtime directory not found: %@", jsRuntimeDir]});
    }
}

RCT_EXPORT_METHOD(testDeleteMetadataJson:(NSString *)appVersion
                  bundleVersion:(NSString *)bundleVersion
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    NSString *metadataPath = [[bundleDir stringByAppendingPathComponent:folderName] stringByAppendingPathComponent:@"metadata.json"];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:metadataPath]) {
        NSError *error;
        BOOL success = [fileManager removeItemAtPath:metadataPath error:&error];
        if (success) {
            DDLogDebug(@"testDeleteMetadataJson: Deleted metadata.json: %@", metadataPath);
            resolve(@{@"success": @YES, @"message": [NSString stringWithFormat:@"Deleted metadata.json: %@", metadataPath]});
        } else {
            DDLogDebug(@"testDeleteMetadataJson: Error deleting metadata.json: %@", error.localizedDescription);
            reject(@"DELETE_ERROR", error.localizedDescription, error);
        }
    } else {
        DDLogDebug(@"testDeleteMetadataJson: metadata.json not found: %@", metadataPath);
        resolve(@{@"success": @NO, @"message": [NSString stringWithFormat:@"metadata.json not found: %@", metadataPath]});
    }
}

RCT_EXPORT_METHOD(testWriteEmptyMetadataJson:(NSString *)appVersion
                  bundleVersion:(NSString *)bundleVersion
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *folderName = [NSString stringWithFormat:@"%@-%@", appVersion, bundleVersion];
    NSString *bundleDir = [BundleUpdateModule bundleDir];
    NSString *jsRuntimeDir = [bundleDir stringByAppendingPathComponent:folderName];
    NSString *metadataPath = [jsRuntimeDir stringByAppendingPathComponent:@"metadata.json"];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    // Ensure directory exists
    if (![fileManager fileExistsAtPath:jsRuntimeDir]) {
        NSError *error;
        BOOL success = [fileManager createDirectoryAtPath:jsRuntimeDir withIntermediateDirectories:YES attributes:nil error:&error];
        if (!success) {
            DDLogDebug(@"testWriteEmptyMetadataJson: Error creating directory: %@", error.localizedDescription);
            reject(@"CREATE_DIR_ERROR", error.localizedDescription, error);
            return;
        }
    }
    
    // Write empty metadata.json
    NSDictionary *emptyMetadata = @{};
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:emptyMetadata options:NSJSONWritingPrettyPrinted error:&error];
    if (jsonData) {
        BOOL success = [jsonData writeToFile:metadataPath atomically:YES];
        if (success) {
            DDLogDebug(@"testWriteEmptyMetadataJson: Created empty metadata.json: %@", metadataPath);
            resolve(@{@"success": @YES, @"message": [NSString stringWithFormat:@"Created empty metadata.json: %@", metadataPath]});
        } else {
            DDLogDebug(@"testWriteEmptyMetadataJson: Error writing metadata.json");
            reject(@"WRITE_ERROR", @"Failed to write metadata.json", nil);
        }
    } else {
        DDLogDebug(@"testWriteEmptyMetadataJson: Error serializing metadata: %@", error.localizedDescription);
        reject(@"SERIALIZE_ERROR", error.localizedDescription, error);
    }
}

RCT_EXPORT_METHOD(getFallbackUpdateBundleData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSArray *fallbackUpdateBundleData = [BundleUpdateModule readFallbackUpdateBundleDataFile];
    resolve(fallbackUpdateBundleData);
}

RCT_EXPORT_METHOD(setCurrentUpdateBundleData:(NSDictionary *)params) {
    NSString *appVersion = params[@"appVersion"];
    NSString *jsBundleVersion = params[@"bundleVersion"];
    NSString *signature = params[@"signature"];
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    NSString *bundleVersion = [NSString stringWithFormat:@"%@-%@", appVersion, jsBundleVersion];
    [userDefaults setObject:bundleVersion forKey:@"currentBundleVersion"];
    [userDefaults setObject:signature forKey:bundleVersion];
    [userDefaults synchronize];
}

RCT_EXPORT_METHOD(clearAllJSBundleData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *bundleDir = [BundleUpdateModule bundleDir];
        NSFileManager *fileManager = [NSFileManager defaultManager];
        
        if ([fileManager fileExistsAtPath:bundleDir]) {
            NSError *error;
            BOOL success = [fileManager removeItemAtPath:bundleDir error:&error];
            if (!success) {
                DDLogDebug(@"clearAllJSBundleData: Error removing bundle directory: %@", error.localizedDescription);
                reject(@"DELETE_ERROR", error.localizedDescription, error);
                return;
            }
        }
        
        // Clear all bundle-related preferences
        NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
        NSString *currentBundleVersion = [userDefaults stringForKey:@"currentBundleVersion"];
        if (currentBundleVersion) {
            [userDefaults removeObjectForKey:currentBundleVersion];
            [userDefaults removeObjectForKey:@"currentBundleVersion"];
        }
        [userDefaults removeObjectForKey:@"nativeVersion"];
        [userDefaults synchronize];
        
        DDLogDebug(@"clearAllJSBundleData: Successfully cleared all JS bundle data");
        resolve(@{@"success": @YES, @"message": @"Successfully cleared all JS bundle data"});
    } @catch (NSException *exception) {
        DDLogDebug(@"clearAllJSBundleData: Exception: %@", exception.reason);
        reject(@"CLEAR_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getNativeAppVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *nativeVersion = [BundleUpdateModule getCurrentNativeVersion];
    resolve(nativeVersion);
}

RCT_EXPORT_METHOD(getJsBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *jsBundlePath = [BundleUpdateModule currentBundleMainJSBundle];
    resolve(jsBundlePath);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(jsBundlePath) {
    NSString *jsBundlePath = [BundleUpdateModule currentBundleMainJSBundle];
    if (jsBundlePath == nil) {
        return @"";
    }
    return jsBundlePath;
}

@end
