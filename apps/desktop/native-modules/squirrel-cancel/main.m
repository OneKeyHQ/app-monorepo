#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <Security/Security.h>
#import <ServiceManagement/ServiceManagement.h>
#import <CommonCrypto/CommonDigest.h>
#import <libproc.h>
#import <sys/stat.h>
#import <sys/sysctl.h>
#import <unistd.h>

static BOOL mayHaveRemovedJob = NO;

// This executable never installs or restores an app. Only the launchd task
// captured after this parent's successful native staging can be revoked.
static void Require(BOOL condition, NSString *code) {
    if (!condition) @throw [NSException exceptionWithName:code reason:code userInfo:nil];
}
static NSString *Real(NSString *path) {
    Require([path isKindOfClass:NSString.class], @"INVALID_PATH");
    char result[PATH_MAX];
    Require(realpath(path.fileSystemRepresentation, result) != NULL, @"MISSING_PATH");
    return @(result);
}
static NSData *Read(NSString *path) {
    struct stat st;
    Require(lstat(path.fileSystemRepresentation, &st) == 0 && S_ISREG(st.st_mode) && st.st_uid == getuid(), @"INVALID_REQUEST_FILE");
    Require(st.st_size > 0 && st.st_size <= 65536, @"INVALID_REQUEST_FILE");
    NSData *data = [NSData dataWithContentsOfFile:path];
    Require(data != nil, @"READ_FAILED");
    return data;
}
static NSDictionary *JSON(NSData *data) {
    id value = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    Require([value isKindOfClass:NSDictionary.class], @"INVALID_JSON");
    return value;
}
static NSString *Hash(NSData *data) {
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(data.bytes, (CC_LONG)data.length, hash);
    NSMutableString *result = [NSMutableString string];
    for (NSUInteger i = 0; i < sizeof(hash); i++) [result appendFormat:@"%02x", hash[i]];
    return result;
}
static NSString *ProcessPath(pid_t pid) {
    char path[PROC_PIDPATHINFO_MAXSIZE];
    Require(proc_pidpath(pid, path, sizeof(path)) > 0, @"PROCESS_NOT_FOUND");
    return Real(@(path));
}
static NSDictionary *Process(pid_t pid) {
    struct kinfo_proc info = {0};
    size_t size = sizeof(info);
    int keys[] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, pid};
    Require(sysctl(keys, 4, &info, &size, NULL, 0) == 0 && size == sizeof(info) && info.kp_proc.p_pid == pid, @"PROCESS_NOT_FOUND");
    return @{@"pid": @(pid), @"uid": @(info.kp_eproc.e_ucred.cr_uid), @"start": @(info.kp_proc.p_starttime.tv_sec), @"micros": @(info.kp_proc.p_starttime.tv_usec)};
}
static void WriteJournal(NSString *path, NSDictionary *journal) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:journal options:0 error:nil];
    Require([data writeToFile:path options:NSDataWritingAtomic error:nil], @"JOURNAL_FAILED");
    Require(chmod(path.fileSystemRepresentation, 0600) == 0, @"JOURNAL_FAILED");
}
static CFStringRef Domain(NSString *domain) {
    Require([@[@"user", @"system"] containsObject:domain], @"INVALID_DOMAIN");
    return [domain isEqual:@"system"] ? kSMDomainSystemLaunchd : kSMDomainUserLaunchd;
}
static NSDictionary *Job(NSString *label, NSString *domain) {
    return CFBridgingRelease(SMJobCopyDictionary(Domain(domain), (__bridge CFStringRef)label));
}
static void VerifySignature(NSString *host, NSString *update) {
    SecStaticCodeRef hostCode = NULL, updateCode = NULL;
    SecRequirementRef requirement = NULL;
    OSStatus status = SecStaticCodeCreateWithPath((__bridge CFURLRef)[NSURL fileURLWithPath:host], kSecCSDefaultFlags, &hostCode);
    if (status == errSecSuccess) status = SecCodeCopyDesignatedRequirement((SecCodeRef)hostCode, kSecCSDefaultFlags, &requirement);
    if (status == errSecSuccess) status = SecStaticCodeCreateWithPath((__bridge CFURLRef)[NSURL fileURLWithPath:update], kSecCSDefaultFlags, &updateCode);
    if (status == errSecSuccess) status = SecStaticCodeCheckValidity(updateCode, kSecCSStrictValidate, requirement);
    if (requirement) CFRelease(requirement);
    if (hostCode) CFRelease(hostCode);
    if (updateCode) CFRelease(updateCode);
    Require(status == errSecSuccess, @"SIGNATURE_MISMATCH");
}
static NSDictionary *Capture(NSDictionary *context, NSString *version, NSNumber *stagedAfter) {
    NSString *label = context[@"label"], *root = context[@"root"], *app = context[@"app"];
    NSDictionary *user = Job(label, @"user"), *system = Job(label, @"system");
    Require(!(user && system), @"AMBIGUOUS_JOB");
    NSDictionary *job = user ?: system;
    Require(job != nil, @"JOB_NOT_FOUND");
    Require(user != nil, @"PRIVILEGED_PREPARATION");
    NSString *domain = @"user";
    NSArray *args = job[@"ProgramArguments"];
    Require([args isKindOfClass:NSArray.class] && args.count == 3, @"FOREIGN_JOB");
    Require([args[1] isEqual:label] && [args[2] isEqual:context[@"state"]], @"FOREIGN_JOB");
    NSString *helper = Real([app stringByAppendingPathComponent:@"Contents/Frameworks/Squirrel.framework/Resources/ShipIt"]);
    Require([Real(args[0]) isEqual:helper], @"FOREIGN_JOB");
    pid_t pid = [job[@"PID"] intValue];
    Require(pid > 1 && [ProcessPath(pid) isEqual:helper], @"JOB_NOT_RUNNING");
    NSDictionary *process = Process(pid);
    Require([stagedAfter isKindOfClass:NSNumber.class] && stagedAfter.doubleValue > 0, @"UNKNOWN_PREPARATION");
    double started = [process[@"start"] doubleValue] * 1000 + [process[@"micros"] doubleValue] / 1000;
    Require(started >= stagedAfter.doubleValue, @"LEGACY_PREPARATION");
    Require([process[@"uid"] unsignedIntValue] == (user ? getuid() : 0), @"FOREIGN_JOB");
    NSData *bytes = Read(context[@"state"]);
    NSDictionary *request = JSON(bytes);
    NSURL *target = [NSURL URLWithString:request[@"targetBundleURL"]];
    NSURL *update = [NSURL URLWithString:request[@"updateBundleURL"]];
    Require(target.isFileURL && update.isFileURL, @"FOREIGN_REQUEST");
    Require([Real(target.path) isEqual:app] && [request[@"bundleIdentifier"] isEqual:context[@"bundleId"]], @"FOREIGN_REQUEST");
    Require([request[@"launchAfterInstallation"] isEqual:@NO], @"INSTALL_HANDOFF_STARTED");
    NSString *updateApp = Real(update.path), *directory = updateApp.stringByDeletingLastPathComponent;
    Require([directory.stringByDeletingLastPathComponent isEqual:root] && [directory.lastPathComponent hasPrefix:@"update."], @"FOREIGN_UPDATE");
    NSBundle *bundle = [NSBundle bundleWithPath:updateApp];
    Require([bundle.bundleIdentifier isEqual:context[@"bundleId"]] && [[bundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] isEqual:version], @"VERSION_MISMATCH");
    VerifySignature(app, updateApp);
    // Never delete state needed to restore an interrupted installation.
    if (user) {
        id owned = CFBridgingRelease(CFPreferencesCopyValue(CFSTR("SQRLInstallerOwnedBundle"), (__bridge CFStringRef)label, kCFPreferencesCurrentUser, kCFPreferencesCurrentHost));
        Require(owned == nil, @"INSTALL_RECOVERY_PENDING");
        id attempts = CFBridgingRelease(CFPreferencesCopyValue(CFSTR("SQRLShipItInstallationAttempts"), (__bridge CFStringRef)label, kCFPreferencesCurrentUser, kCFPreferencesCurrentHost));
        Require(!attempts || [attempts unsignedIntegerValue] == 0, @"INSTALL_RECOVERY_PENDING");
    }
    // Only fresh user-domain staging is revocable. Root recovery ownership and
    // cross-user replacement of the system label cannot be established here.
    return @{@"domain": domain, @"process": process, @"parent": context[@"parent"], @"app": app, @"uid": @(getuid()), @"hash": Hash(bytes), @"directory": directory, @"version": version, @"stagedAfter": stagedAfter};
}
static void RemoveJob(NSDictionary *context, NSDictionary *snapshot) {
    Require([snapshot[@"domain"] isEqual:@"user"], @"PRIVILEGED_PREPARATION");
    Require([Capture(context, snapshot[@"version"], snapshot[@"stagedAfter"]) isEqual:snapshot], @"STAGE_CHANGED");
    CFErrorRef error = NULL;
    mayHaveRemovedJob = YES;
    BOOL removed = SMJobRemove(kSMDomainUserLaunchd, (__bridge CFStringRef)context[@"label"], NULL, true, &error);
    if (error) CFRelease(error);
    Require(removed, @"REMOVE_FAILED");
    Require(!Job(context[@"label"], @"user") && !Job(context[@"label"], @"system"), @"JOB_REPLACED");
}
static NSDictionary *Execute(NSDictionary *input) {
    pid_t parent = getppid();
    NSDictionary *parentInfo = Process(parent);
    Require([parentInfo[@"uid"] unsignedIntValue] == getuid(), @"INVALID_PARENT");
    NSString *exe = ProcessPath(parent);
    NSString *app = exe.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent;
    NSBundle *bundle = [NSBundle bundleWithPath:app];
    NSString *bundleId = bundle.bundleIdentifier;
    Require(bundleId.length && [app.pathExtension isEqual:@"app"] && [Real(bundle.executablePath) isEqual:exe], @"INVALID_PARENT");
    NSString *ownExe = ProcessPath(getpid());
    Require([ownExe isEqual:Real([app stringByAppendingPathComponent:@"Contents/Resources/bin/squirrel-cancel"])], @"INVALID_EXECUTABLE");
    NSArray *instances = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleId];
    Require(instances.count == 1 && ((NSRunningApplication *)instances[0]).processIdentifier == parent, @"MULTIPLE_INSTANCES");
    NSString *label = [bundleId stringByAppendingString:@".ShipIt"];
    NSString *cache = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
    NSString *root = [cache stringByAppendingPathComponent:label];
    NSString *state = [root stringByAppendingPathComponent:@"ShipItState.plist"];
    NSString *journalPath = [root stringByAppendingPathComponent:@"OneKeyCancellation.json"];
    NSDictionary *context = @{@"label": label, @"root": root, @"state": state, @"app": app, @"bundleId": bundleId, @"parent": parentInfo};
    NSString *action = input[@"action"];
    BOOL journalExists = [NSFileManager.defaultManager fileExistsAtPath:journalPath];
    if ([action isEqual:@"capture"]) {
        NSDictionary *previous = journalExists ? JSON(Read(journalPath)) : nil;
        Require(!previous || [previous[@"phase"] isEqual:@"finished"], @"CANCELLATION_PENDING");
        Require([Real(root) isEqual:root], @"FOREIGN_CACHE");
        for (NSUInteger attempt = 0; ; attempt++) {
            @try {
                NSDictionary *snapshot = Capture(context, input[@"version"], input[@"stagedAfter"]);
                if (previous) Require([NSFileManager.defaultManager removeItemAtPath:journalPath error:nil], @"JOURNAL_FAILED");
                return @{@"snapshot": snapshot};
            }
            @catch (NSException *error) {
                if (attempt >= 100 || ![@[@"JOB_NOT_FOUND", @"JOB_NOT_RUNNING"] containsObject:error.name]) @throw;
                [NSThread sleepForTimeInterval:0.05];
            }
        }
    }
    NSDictionary *journal = journalExists ? JSON(Read(journalPath)) : nil;
    if (journal) mayHaveRemovedJob = YES;
    if ([action isEqual:@"finish"]) {
        Require(!Job(label, @"user") && !Job(label, @"system"), @"JOB_REPLACED");
        if (journal) {
            Require([@[@"stopped", @"finished"] containsObject:journal[@"phase"]] && [journal[@"snapshot"][@"app"] isEqual:app], @"CANCELLATION_PENDING");
            Require(![NSFileManager.defaultManager fileExistsAtPath:state] && ![NSFileManager.defaultManager fileExistsAtPath:journal[@"snapshot"][@"directory"]], @"CLEANUP_FAILED");
            WriteJournal(journalPath, @{@"phase": @"finished", @"snapshot": journal[@"snapshot"]});
        }
        return @{@"status": @"finished"};
    }
    Require([action isEqual:@"cancel"], @"INVALID_ACTION");
    NSDictionary *snapshot = journal ? journal[@"snapshot"] : input[@"snapshot"];
    if ((id)snapshot == NSNull.null) snapshot = nil;
    if (!snapshot) {
        Require(!Job(label, @"user") && !Job(label, @"system"), @"UNKNOWN_PREPARATION");
        return @{@"status": @"not-staged"};
    }
    Require([snapshot isKindOfClass:NSDictionary.class] && [snapshot[@"app"] isEqual:app] && [snapshot[@"uid"] unsignedIntValue] == getuid(), @"FOREIGN_SNAPSHOT");
    Require([snapshot[@"domain"] isEqual:@"user"], @"PRIVILEGED_PREPARATION");
    Require([Real(root) isEqual:root], @"FOREIGN_CACHE");
    NSString *directory = snapshot[@"directory"];
    Require([directory isKindOfClass:NSString.class] && [directory.stringByDeletingLastPathComponent isEqual:root] && [directory.lastPathComponent hasPrefix:@"update."], @"FOREIGN_UPDATE");
    BOOL stopped = [@[@"stopped", @"finished"] containsObject:journal[@"phase"] ?: @""];
    if (!stopped) {
        Require([snapshot[@"parent"] isEqual:parentInfo], @"UNKNOWN_PREPARATION");
        if (journal && !Job(label, @"user") && !Job(label, @"system")) {
            // Removal may have succeeded just before the helper was interrupted.
            // Only the original still-running parent may close this narrow gap.
            NSDictionary *process = snapshot[@"process"];
            struct kinfo_proc info = {0}; size_t size = sizeof(info);
            int keys[] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, [process[@"pid"] intValue]};
            Require(sysctl(keys, 4, &info, &size, NULL, 0) == 0 && size == 0, @"PROCESS_STILL_RUNNING");
            Require([Hash(Read(state)) isEqual:snapshot[@"hash"]], @"REQUEST_CHANGED");
        } else {
            Require([Capture(context, snapshot[@"version"], snapshot[@"stagedAfter"]) isEqual:snapshot], @"STAGE_CHANGED");
            WriteJournal(journalPath, @{@"phase": @"prepared", @"snapshot": snapshot});
            @try { RemoveJob(context, snapshot); }
            @catch (NSException *error) {
                @try {
                    if ([Capture(context, snapshot[@"version"], snapshot[@"stagedAfter"]) isEqual:snapshot]) {
                        if ([NSFileManager.defaultManager removeItemAtPath:journalPath error:nil]) mayHaveRemovedJob = NO;
                    }
                } @catch (__unused NSException *ignored) {}
                @throw error;
            }
        }
        WriteJournal(journalPath, @{@"phase": @"stopped", @"snapshot": snapshot});
    }
    Require(!Job(label, @"user") && !Job(label, @"system"), @"JOB_REPLACED");
    if ([NSFileManager.defaultManager fileExistsAtPath:state]) {
        Require([Hash(Read(state)) isEqual:snapshot[@"hash"]], @"REQUEST_CHANGED");
        Require([NSFileManager.defaultManager removeItemAtPath:state error:nil], @"CLEANUP_FAILED");
    }
    if ([NSFileManager.defaultManager fileExistsAtPath:directory]) {
        Require([Real(directory) isEqual:directory], @"FOREIGN_UPDATE");
        Require([NSFileManager.defaultManager removeItemAtPath:directory error:nil], @"CLEANUP_FAILED");
    }
    return @{@"status": @"cancelled"};
}
int main(void) {
    @autoreleasepool {
        NSDictionary *result;
        @try {
            // Read at most 64 KiB; do not accept paths or commands in argv.
            NSData *data = [NSFileHandle.fileHandleWithStandardInput readDataOfLength:65537];
            Require(data.length > 0 && data.length <= 65536, @"INVALID_INPUT");
            result = Execute(JSON(data));
        } @catch (NSException *error) {
            result = @{@"error": error.name ?: @"UNKNOWN", @"unchanged": @(!mayHaveRemovedJob)};
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
        [NSFileHandle.fileHandleWithStandardOutput writeData:data];
        return result[@"error"] ? 1 : 0;
    }
}
