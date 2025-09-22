#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface Verification : NSObject

+ (NSString *)extractedTextContentFromVerifyAscFile:(NSString *)ascFileContent error:(NSError **)error;
+ (BOOL)testExtractedSha256FromVerifyAscFile;

@end

NS_ASSUME_NONNULL_END
