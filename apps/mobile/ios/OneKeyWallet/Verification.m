#import "Verification.h"
#import <CocoaLumberjack/CocoaLumberjack.h>
#import <ObjectivePGP/ObjectivePGP.h>

static const DDLogLevel ddLogLevel = DDLogLevelVerbose;

// PGP Public Key - same as Java version
static NSString * const PUBLIC_KEY = @"-----BEGIN PGP PUBLIC KEY BLOCK-----\n"
@"\n"
@"mQINBGJATGwBEADL1K7b8dzYYzlSsvAGiA8mz042pygB7AAh/uFUycpNQdSzuoDE\n"
@"VoXq/QsXCOsGkMdFLwlUjarRaxFX6RTV6S51LOlJFRsyGwXiMz08GSNagSafQ0YL\n"
@"Gi+aoemPh6Ta5jWgYGIUWXavkjJciJYw43ACMdVmIWos94bA41Xm93dq9C3VRpl+\n"
@"EjvGAKRUMxJbH8r13TPzPmfN4vdrHLq+us7eKGJpwV/VtD9vVHAi0n48wGRq7DQw\n"
@"IUDU2mKy3wmjwS38vIIu4yQyeUdl4EqwkCmGzWc7Cv2HlOG6rLcUdTAOMNBBX1IQ\n"
@"iHKg9Bhh96MXYvBhEL7XHJ96S3+gTHw/LtrccBM+eiDJVHPZn+lw2HqX994DueLV\n"
@"tAFDS+qf3ieX901IC97PTHsX6ztn9YZQtSGBJO3lEMBdC4ez2B7zUv4bgyfU+KvE\n"
@"zHFIK9HmDehx3LoDAYc66nhZXyasiu6qGPzuxXu8/4qTY8MnhXJRBkbWz5P84fx1\n"
@"/Db5WETLE72on11XLreFWmlJnEWN4UOARrNn1Zxbwl+uxlSJyM+2GTl4yoccG+WR\n"
@"uOUCmRXTgduHxejPGI1PfsNmFpVefAWBDO7SdnwZb1oUP3AFmhH5CD1GnmLnET+l\n"
@"/c+7XfFLwgSUVSADBdO3GVS4Cr9ux4nIrHGJCrrroFfM2yvG8AtUVr16PQARAQAB\n"
@"tCJvbmVrZXlocSBkZXZlbG9wZXIgPGRldkBvbmVrZXkuc28+iQJUBBMBCAA+FiEE\n"
@"62iuVE8f3YzSZGJPs2mmepC/OHsFAmJATGwCGwMFCQeGH0QFCwkIBwIGFQoJCAsC\n"
@"BBYCAwECHgECF4AACgkQs2mmepC/OHtgvg//bsWFMln08ZJjf5od/buJua7XYb3L\n"
@"jWq1H5rdjJva5TP1UuQaDULuCuPqllxb+h+RB7g52yRG/1nCIrpTfveYOVtq/mYE\n"
@"D12KYAycDwanbmtoUp25gcKqCrlNeSE1EXmPlBzyiNzxJutE1DGlvbY3rbuNZLQi\n"
@"UTFBG3hk6JgsaXkFCwSmF95uATAaItv8aw6eY7RWv47rXhQch6PBMCir4+a/v7vs\n"
@"lXxQtcpCqfLtjrloq7wvmD423yJVsUGNEa7/BrwFz6/GP6HrUZc6JgvrieuiBE4n\n"
@"ttXQFm3dkOfD+67MLMO3dd7nPhxtjVEGi+43UH3/cdtmU4JFX3pyCQpKIlXTEGp2\n"
@"wqim561auKsRb1B64qroCwT7aACwH0ZTgQS8rPifG3QM8ta9QheuOsjHLlqjo8jI\n"
@"fpqe0vKYUlT092joT0o6nT2MzmLmHUW0kDqD9p6JEJEZUZpqcSRE84eMTFNyu966\n"
@"xy/rjN2SMJTFzkNXPkwXYrMYoahGez1oZfLzV6SQ0+blNc3aATt9aQW6uaCZtMw1\n"
@"ibcfWW9neHVpRtTlMYCoa2reGaBGCv0Nd8pMcyFUQkVaes5cQHkh3r5Dba+YrVvp\n"
@"l4P8HMbN8/LqAv7eBfj3ylPa/8eEPWVifcum2Y9TqherN1C2JDqWIpH4EsApek3k\n"
@"NMK6q0lPxXjZ3Pa5Ag0EYkBMbAEQAM1R4N3bBkwKkHeYwsQASevUkHwY4eg6Ncgp\n"
@"f9NbmJHcEioqXTIv0nHCQbos3P2NhXvDowj4JFkK/ZbpP9yo0p7TI4fckseVSWwI\n"
@"tiF9l/8OmXvYZMtw3hHcUUZVdJnk0xrqT6ni6hyRFIfbqous6/vpqi0GG7nB/+lU\n"
@"E5StGN8696ZWRyAX9MmwoRoods3ShNJP0+GCYHfIcG0XRhEDMJph+7mWPlkQUcza\n"
@"4aEjxOQ4Stwwp+ZL1rXSlyJIPk1S9/FIS/Uw5GgqFJXIf5n+SCVtUZ8lGedEWwe4\n"
@"wXsoPFxxOc2Gqw5r4TrJFdgA3MptYebXmb2LGMssXQTM1AQS2LdpnWw44+X1CHvQ\n"
@"0m4pEw/g2OgeoJPBurVUnu2mU/M+ARZiS4ceAR0pLZN7Yq48p1wr6EOBQdA3Usby\n"
@"uc17MORG/IjRmjz4SK/luQLXjN+0jwQSoM1kcIHoRk37B8feHjVufJDKlqtw83H1\n"
@"uNu6lGwb8MxDgTuuHloDijCDQsn6m7ZKU1qqLDGtdvCUY2ovzuOUS9vv6MAhR86J\n"
@"kqoU3sOBMeQhnBaTNKU0IjT4M+ERCWQ7MewlzXuPHgyb4xow1SKZny+f+fYXPy9+\n"
@"hx4/j5xaKrZKdq5zIo+GRGe4lA088l253nGeLgSnXsbSxqADqKK73d7BXLCVEZHx\n"
@"f4Sa5JN7ABEBAAGJAjwEGAEIACYWIQTraK5UTx/djNJkYk+zaaZ6kL84ewUCYkBM\n"
@"bAIbDAUJB4YfRAAKCRCzaaZ6kL84e0UGD/4mVWyGoQC86TyPoU4Pb5r8mynXWmiH\n"
@"ZGKu2ll8qn3l5Q67OophgbA1I0GTBFsYK2f91ahgs7FEsLrmz/25E8ybcdJipITE\n"
@"6869nyE1b37jVb3z3BJLYS/4MaNvugNz4VjMHWVAL52glXLN+SJBSNscmWZDKnVn\n"
@"Rnrn+kBEvOWZgLbi4MpPiNVwm2PGnrtPzudTcg/NS3HOcmJTfG3mrnwwNJybTVAx\n"
@"txlQPoXUpJQqJjtkPPW+CqosolpRdugQ5zpFSg05iL+vN+CMrVPkk85w87dtsidl\n"
@"yZl/ZNITrLzym9d2UFVQZY2rRohNdRfx3l4rfXJFLaqQtihRvBIiMKTbUb2V0pd3\n"
@"rVLz2Ck3gJqPfPEEmCWS0Nx6rME8m0sOkNyMau3dMUUAs4j2c3pOQmsZRjKo7LAc\n"
@"7/GahKFhZ2aBCQzvcTES+gPH1Z5HnivkcnUF2gnQV9x7UOr1Q/euKJsxPl5CCZtM\n"
@"N9GFW10cDxFo7cO5Ch+/BkkkfebuI/4Wa1SQTzawsxTx4eikKwcemgfDsyIqRs2W\n"
@"62PBrqCzs9Tg19l35sCdmvYsvMadrYFXukHXiUKEpwJMdTLAtjJ+AX84YLwuHi3+\n"
@"qZ5okRCqZH+QpSojSScT9H5ze4ZpuP0d8pKycxb8M2RfYdyOtT/eqsZ/1EQPg7kq\n"
@"P2Q5dClenjjjVA==\n"
@"=F0np\n"
@"-----END PGP PUBLIC KEY BLOCK-----";

@implementation Verification

+ (NSString *)extractedTextContentFromVerifyAscFile:(NSString *)ascFileContent error:(NSError **)error {
    if (!ascFileContent) {
        if (error) {
            *error = [NSError errorWithDomain:@"VerificationError" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"Invalid parameters"}];
        }
        return nil;
    }
    
    @try {
        // Parse the public key
        NSData *publicKeyData = [PUBLIC_KEY dataUsingEncoding:NSUTF8StringEncoding];
      
        NSError *publicKeyError = nil;
        NSArray<PGPKey *> *publicKeys = [ObjectivePGP readKeysFromData:publicKeyData error:&publicKeyError];

        if (publicKeyError) {
            DDLogError(@"Failed to parse public key: %@", publicKeyError.localizedDescription);
            return nil;
        }
        
        // Parse the signed message
        NSData *signatureData = [ascFileContent dataUsingEncoding:NSUTF8StringEncoding];
        
        // Verify the signature and extract clear text
        NSError *verifyError = nil;
        BOOL verified = [ObjectivePGP verifySignature:signatureData usingKeys:publicKeys passphraseForKey:nil error:&verifyError];

        if (!verified || verifyError) {
            DDLogError(@"PGP verification failed: %@", verifyError.localizedDescription);
            return nil;
        }
        
        // Extract the clear text between PGP message markers
        NSString *beginMarker = @"-----BEGIN PGP SIGNED MESSAGE-----";
        NSString *endMarker = @"-----BEGIN PGP SIGNATURE-----";
        
        NSRange beginRange = [ascFileContent rangeOfString:beginMarker];
        NSRange endRange = [ascFileContent rangeOfString:endMarker];
        
        if (beginRange.location == NSNotFound || endRange.location == NSNotFound) {
            DDLogError(@"PGP message markers not found");
            return nil;
        }
        
        // Find the start of the actual content (after the hash line)
        NSUInteger contentStart = beginRange.location + beginRange.length;
        // Extract content up to the signature marker
        NSUInteger contentEnd = endRange.location;
        if (contentStart >= contentEnd) {
            DDLogError(@"Invalid PGP message format");
            return nil;
        }
        
        NSString *clearText = [ascFileContent substringWithRange:NSMakeRange(contentStart, contentEnd - contentStart)];
        // Trim whitespace and newlines
        clearText = [clearText stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        return clearText;
    } @catch (NSException *exception) {
        DDLogError(@"Exception during PGP verification: %@", exception.reason);
        return nil;
    }
}

@end
