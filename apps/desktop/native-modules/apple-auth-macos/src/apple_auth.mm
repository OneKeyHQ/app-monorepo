/**
 * Native Apple Sign-In for macOS Electron apps
 *
 * Uses ASAuthorizationController from AuthenticationServices framework
 * to perform native Apple Sign-In and return the identity token.
 *
 * Reference:
 * - https://developer.apple.com/documentation/authenticationservices/asauthorizationcontroller
 * - https://developer.apple.com/documentation/authenticationservices/asauthorizationappleidprovider
 */

#import <napi.h>
#import <AuthenticationServices/AuthenticationServices.h>
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CommonCrypto/CommonCrypto.h>

// ============================================================================
// Helper Functions
// ============================================================================

// Helper: Generate SHA256 hash of a string (for nonce)
static NSString* sha256(NSString* input) {
    const char* str = [input UTF8String];
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(str, (CC_LONG)strlen(str), hash);

    NSMutableString* output = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [output appendFormat:@"%02x", hash[i]];
    }
    return output;
}

// Helper: Generate a random nonce string
static NSString* generateNonce(int length) {
    NSMutableString* nonce = [NSMutableString stringWithCapacity:length];
    NSString* chars = @"0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
    for (int i = 0; i < length; i++) {
        uint32_t index = arc4random_uniform((uint32_t)[chars length]);
        [nonce appendFormat:@"%C", [chars characterAtIndex:index]];
    }
    return nonce;
}

// ============================================================================
// Result Data Structure (thread-safe, plain C++ data)
// ============================================================================

struct AppleAuthResult {
    bool success;
    std::string errorMessage;
    std::string identityToken;
    std::string authorizationCode;
    std::string user;
    std::string email;
    std::string fullName;
    std::string rawNonce;
};

// ============================================================================
// Delegate class for ASAuthorizationController
// ============================================================================

API_AVAILABLE(macos(10.15))
@interface AppleAuthDelegate : NSObject <ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding>
@property (nonatomic, copy) void (^completionHandler)(AppleAuthResult result);
@property (nonatomic, strong) NSString* rawNonce;
@end

@implementation AppleAuthDelegate

- (ASPresentationAnchor)presentationAnchorForAuthorizationController:(ASAuthorizationController *)controller API_AVAILABLE(macos(10.15)) {
    // Return the key window as presentation anchor
    return [[NSApplication sharedApplication] keyWindow] ?: [[NSApplication sharedApplication] mainWindow];
}

- (void)authorizationController:(ASAuthorizationController *)controller
   didCompleteWithAuthorization:(ASAuthorization *)authorization API_AVAILABLE(macos(10.15)) {
    AppleAuthResult result = {};
    result.success = false;

    if ([authorization.credential isKindOfClass:[ASAuthorizationAppleIDCredential class]]) {
        ASAuthorizationAppleIDCredential* credential = (ASAuthorizationAppleIDCredential*)authorization.credential;

        result.success = true;

        if (credential.identityToken) {
            NSString* token = [[NSString alloc] initWithData:credential.identityToken encoding:NSUTF8StringEncoding];
            if (token) {
                result.identityToken = [token UTF8String];
            }
        }

        if (credential.authorizationCode) {
            NSString* code = [[NSString alloc] initWithData:credential.authorizationCode encoding:NSUTF8StringEncoding];
            if (code) {
                result.authorizationCode = [code UTF8String];
            }
        }

        if (credential.user) {
            result.user = [credential.user UTF8String];
        }

        if (credential.email) {
            result.email = [credential.email UTF8String];
        }

        if (credential.fullName) {
            NSPersonNameComponentsFormatter* formatter = [[NSPersonNameComponentsFormatter alloc] init];
            formatter.style = NSPersonNameComponentsFormatterStyleDefault;
            NSString* fullName = [formatter stringFromPersonNameComponents:credential.fullName];
            if (fullName && [fullName length] > 0) {
                result.fullName = [fullName UTF8String];
            }
        }

        if (self.rawNonce) {
            result.rawNonce = [self.rawNonce UTF8String];
        }
    } else {
        result.errorMessage = "Unknown credential type";
    }

    if (self.completionHandler) {
        self.completionHandler(result);
    }
}

- (void)authorizationController:(ASAuthorizationController *)controller
           didCompleteWithError:(NSError *)error API_AVAILABLE(macos(10.15)) {
    AppleAuthResult result = {};
    result.success = false;

    if (error.code == ASAuthorizationErrorCanceled) {
        result.errorMessage = "User cancelled Apple Sign-In";
    } else {
        result.errorMessage = [[NSString stringWithFormat:@"Apple Sign-In failed: %@", error.localizedDescription] UTF8String];
    }

    if (self.completionHandler) {
        self.completionHandler(result);
    }
}

@end

// ============================================================================
// Async Worker for Apple Sign-In
// ============================================================================

class AppleSignInWorker : public Napi::AsyncWorker {
public:
    AppleSignInWorker(Napi::Env env, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(env), deferred_(deferred) {}

    void Execute() override {
        // This runs in a worker thread, but we need to call Apple APIs on main thread
        // So we use dispatch_sync to run on main thread and wait for result
        
        if (@available(macOS 10.15, *)) {
            __block AppleAuthResult blockResult = {};
            __block bool completed = false;
            __block NSCondition* condition = [[NSCondition alloc] init];
            
            // Generate nonce
            NSString* rawNonce = generateNonce(32);
            NSString* hashedNonce = sha256(rawNonce);
            
            dispatch_async(dispatch_get_main_queue(), ^{
                // Create Apple ID provider and request
                ASAuthorizationAppleIDProvider* provider = [[ASAuthorizationAppleIDProvider alloc] init];
                ASAuthorizationAppleIDRequest* request = [provider createRequest];
                request.requestedScopes = @[ASAuthorizationScopeFullName, ASAuthorizationScopeEmail];
                request.nonce = hashedNonce;

                // Create authorization controller
                ASAuthorizationController* controller = [[ASAuthorizationController alloc]
                    initWithAuthorizationRequests:@[request]];

                // Create delegate
                AppleAuthDelegate* delegate = [[AppleAuthDelegate alloc] init];
                delegate.rawNonce = rawNonce;
                
                // Store delegate to prevent deallocation
                static AppleAuthDelegate* gDelegate = nil;
                gDelegate = delegate;
                
                delegate.completionHandler = ^(AppleAuthResult res) {
                    [condition lock];
                    blockResult = res;
                    completed = true;
                    [condition signal];
                    [condition unlock];
                    gDelegate = nil; // Release delegate
                };

                controller.delegate = delegate;
                controller.presentationContextProvider = delegate;

                // Perform authorization request
                [controller performRequests];
            });
            
            // Wait for completion (with timeout)
            [condition lock];
            NSDate* timeout = [NSDate dateWithTimeIntervalSinceNow:300]; // 5 minutes
            while (!completed) {
                if (![condition waitUntilDate:timeout]) {
                    // Timeout
                    blockResult.success = false;
                    blockResult.errorMessage = "Apple Sign-In timed out";
                    break;
                }
            }
            [condition unlock];
            
            result_ = blockResult;
        } else {
            result_.success = false;
            result_.errorMessage = "Apple Sign-In requires macOS 10.15 or later";
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        
        if (result_.success) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("identityToken", Napi::String::New(env, result_.identityToken));
            
            if (!result_.authorizationCode.empty()) {
                obj.Set("authorizationCode", Napi::String::New(env, result_.authorizationCode));
            }
            if (!result_.user.empty()) {
                obj.Set("user", Napi::String::New(env, result_.user));
            }
            if (!result_.email.empty()) {
                obj.Set("email", Napi::String::New(env, result_.email));
            }
            if (!result_.fullName.empty()) {
                obj.Set("fullName", Napi::String::New(env, result_.fullName));
            }
            if (!result_.rawNonce.empty()) {
                obj.Set("rawNonce", Napi::String::New(env, result_.rawNonce));
            }
            
            deferred_.Resolve(obj);
        } else {
            deferred_.Reject(Napi::Error::New(env, result_.errorMessage).Value());
        }
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    Napi::Promise::Deferred deferred_;
    AppleAuthResult result_;
};

// ============================================================================
// N-API Functions
// ============================================================================

/**
 * Check if Apple Sign-In is available on this system.
 * Requires macOS 10.15 (Catalina) or later.
 */
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (@available(macOS 10.15, *)) {
        return Napi::Boolean::New(env, true);
    }
    return Napi::Boolean::New(env, false);
}

/**
 * Perform Apple Sign-In and return identity token.
 *
 * Returns a Promise that resolves with:
 * {
 *   identityToken: string,    // JWT token to send to Supabase
 *   authorizationCode: string,
 *   user: string,             // Apple user ID
 *   email: string | null,     // Only on first sign-in
 *   fullName: string | null,  // Only on first sign-in
 *   rawNonce: string          // Raw nonce for Supabase validation
 * }
 *
 * Or rejects with an error.
 */
Napi::Value SignIn(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    if (@available(macOS 10.15, *)) {
        AppleSignInWorker* worker = new AppleSignInWorker(env, deferred);
        worker->Queue();
    } else {
        deferred.Reject(Napi::Error::New(env, "Apple Sign-In requires macOS 10.15 or later").Value());
    }

    return deferred.Promise();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));
    exports.Set("signIn", Napi::Function::New(env, SignIn));
    return exports;
}

NODE_API_MODULE(apple_auth, Init)
