# Release R8 policy (Google and Prod)
# build.gradle enables shrinking, obfuscation, and optimization with
# proguard-android-optimize.txt. Resource shrinking is configured separately.
# The goal is to remove unused DEX code while preserving JNI/reflective entry
# points that R8 cannot infer from ordinary Java/Kotlin calls.
#
# Android main/bg have independent JS heaps and initialization order, but load
# the same DEX/native libraries. Both runtimes' native contracts must survive.
# Generated @Keep/DoNotStrip annotations and dependency consumer rules cover
# most modules, including ReactContext Activity fields and EventBus Subscribe.
# Add rules for uncovered contracts instead of keeping all OneKey/SDK classes.
#
# Dependency decisions are implemented in build.gradle, not by keep rules:
# - Amazon Store is excluded from both flavors. Hybrid Common brings it in,
#   neither flavor selects Amazon billing, and its global -dontoptimize rule
#   would disable optimization for the entire app. RevenueCat core's Amazon
#   adapters may remain; the optional store module and Appstore SDK must not.
# - Location is excluded only from Google. Billing brings it in without any
#   identified app/runtime references; JPush FCM's broad GMS keep rule otherwise
#   retains its unused classes. Prod can remove those classes through R8.
# - Ads Identifier stays: current Mixpanel/PostHog ID setters do not collect
#   advertising IDs, but RevenueCat's collection API lacks missing-class recovery.
# - Blockstore stays: RevenueCat calls it during login, purchase, and restore.
#   Removing it disables anonymous subscription identity backup/recovery, even
#   though normal Prime purchases first log in with a OneKey user ID.
# - RevenueCat core, Hybrid Common, and Google Billing serve Prime purchases.
# Recheck these decisions when upgrading RN Purchases 10.4.3, Hybrid Common
# 18.21.0, RevenueCat Android 10.13.0, or Billing 8.3.0.
#
# allowoptimization preserves the specified existence/names while allowing
# method-body optimization. keepclassmembers does not force its owner to live;
# keepnames still allows unused classes to be removed. dontwarn only suppresses
# missing-class diagnostics; it does not supply runtime classes or protect JNI.

# Preserve the existing Reanimated/TurboModule native interoperability rules.
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Nitro's generated JNI factories instantiate concrete HybridObjects by class name.
# Keep their public no-arg constructors; generated annotations cover other members.
-keep class * extends com.margelo.nitro.core.HybridObject {
    public <init>();
}

# C++ resolves these callback interfaces and methods by their JVM names.
# Cover both main and background segment evaluation, including concrete callbacks.
-keep interface com.splitbundleloader.SplitBundleLoaderModule$SegmentEvalCallback {
    public void onComplete(java.lang.String);
}
-keepclassmembers class * implements com.splitbundleloader.SplitBundleLoaderModule$SegmentEvalCallback {
    public void onComplete(java.lang.String);
}
-keep interface com.backgroundthread.BackgroundThreadManager$SegmentEvalCallback {
    public void onComplete(java.lang.String);
}
-keepclassmembers class * implements com.backgroundthread.BackgroundThreadManager$SegmentEvalCallback {
    public void onComplete(java.lang.String);
}

# The background Activity bridge matches this listener's original class prefix.
-keep class com.reactnativegooglesignin.RNGoogleSigninModule$RNGoogleSigninActivityEventListener {
    public void onActivityResult(android.app.Activity, int, int, android.content.Intent);
}

# SplitBundleLoader reflectively queries the OTA directory and hash requirement.
-keep,allowoptimization class com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid {
    public static final com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid INSTANCE;
    public static java.lang.String getCurrentBundleMainJSBundle(android.content.Context);
    public static boolean currentBundleRequiresPerSegmentHash(android.content.Context);
}

# Optional native-module logging resolves these static methods through reflection.
-keep,allowoptimization class com.margelo.nitro.nativelogger.OneKeyLog {
    public static void debug(java.lang.String, java.lang.String);
    public static void info(java.lang.String, java.lang.String);
    public static void warn(java.lang.String, java.lang.String);
    public static void error(java.lang.String, java.lang.String);
}

# JPush/JCore use JNI and reflection internally, including their service classes.
# Their closed-source internals have not been proven safe with narrower rules.
# This does not add another blanket GMS/Firebase keep rule to the app.
-keep class cn.jpush.** { *; }
-keep class cn.jiguang.** { *; }

# The bundled JCore disables its optional dynamic-loader branch.
-dontwarn cn.jiguang.dy.JDynamicLoadBase
# JNA resolves native callbacks and structure fields through reflection.
# Include generated bridge subclasses outside com.sun.jna, such as Rust bindings.
-keep class com.sun.jna.** { *; }
-keep class * extends com.sun.jna.** { *; }
# Realm's JNI_OnLoad resolves its TLS helper by this fixed class name.
-keep class io.realm.react.util.SSLHelper { *; }

# Juicebox's Rust JNI bridge resolves these DTOs and errors by JVM name.
# Preserve field/constructor/error contracts, but allow implementation optimization.
# Only the actual JNI-facing types are kept, rather than the whole SDK package.
-keep,allowoptimization class xyz.juicebox.sdk.internal.Native$HttpHeader { *; }
-keep,allowoptimization class xyz.juicebox.sdk.internal.Native$HttpRequest { *; }
-keep,allowoptimization class xyz.juicebox.sdk.internal.Native$HttpResponse { *; }
-keep,allowoptimization class xyz.juicebox.sdk.Realm { *; }
-keep,allowoptimization class xyz.juicebox.sdk.RealmId { *; }
-keep,allowoptimization enum xyz.juicebox.sdk.RegisterError { *; }
-keep,allowoptimization enum xyz.juicebox.sdk.RecoverError { *; }
-keep,allowoptimization enum xyz.juicebox.sdk.DeleteError { *; }
-keep,allowoptimization class xyz.juicebox.sdk.RegisterException { *; }
-keep,allowoptimization class xyz.juicebox.sdk.RecoverException { *; }
-keep,allowoptimization class xyz.juicebox.sdk.DeleteException { *; }

# Native code invokes these callbacks on concrete Java implementations.
# Implementation class names may change; interface and callback signatures may not.
-keep,allowoptimization interface xyz.juicebox.sdk.internal.Native$GetAuthTokenFn {
    public void get(long, long, xyz.juicebox.sdk.RealmId);
}
-keepclassmembers,allowoptimization class * implements xyz.juicebox.sdk.internal.Native$GetAuthTokenFn {
    public void get(long, long, xyz.juicebox.sdk.RealmId);
}
-keep,allowoptimization interface xyz.juicebox.sdk.internal.Native$HttpSendFn {
    public void send(long, xyz.juicebox.sdk.internal.Native$HttpRequest);
}
-keepclassmembers,allowoptimization class * implements xyz.juicebox.sdk.internal.Native$HttpSendFn {
    public void send(long, xyz.juicebox.sdk.internal.Native$HttpRequest);
}

# GPG verification includes exception simple names in its failure reasons.
# Stabilize ERROR_* diagnostics without forcing unused exception types to survive.
-keepnames class org.bouncycastle.openpgp.*Exception

# BouncyCastle discovers these JCA services by name for RSA/SHA-2 GPG verification.
# Digest mappings derive implementation prefixes from the enclosing class name.
# Service names and public no-arg constructors must survive; preserving just the
# implementation while renaming its enclosing prefix causes NoSuchAlgorithmException.
# Other unused algorithms and constructors remain eligible for removal.
-keepnames class org.bouncycastle.jcajce.provider.digest.SHA256
-keepnames class org.bouncycastle.jcajce.provider.digest.SHA384
-keepnames class org.bouncycastle.jcajce.provider.digest.SHA512
-keep,allowoptimization class org.bouncycastle.jcajce.provider.asymmetric.RSA$Mappings { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.asymmetric.rsa.KeyFactorySpi { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.asymmetric.rsa.DigestSignatureSpi$SHA256 { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.asymmetric.rsa.DigestSignatureSpi$SHA384 { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.asymmetric.rsa.DigestSignatureSpi$SHA512 { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA256$Mappings { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA256$Digest { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA384$Mappings { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA384$Digest { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA512$Mappings { public <init>(); }
-keep,allowoptimization class org.bouncycastle.jcajce.provider.digest.SHA512$Digest { public <init>(); }

# Expo reflectively reads and replaces these fields; its rules omit type packages.
# Fully qualified field types protect the real members, not unmatched simple types.
-keepclassmembers class com.facebook.react.ReactActivityDelegate {
    private com.facebook.react.ReactDelegate mReactDelegate;
}
-keepclassmembers class com.facebook.react.ReactActivity {
    private final com.facebook.react.ReactActivityDelegate mDelegate;
}

# JNA's desktop window-handle API references AWT, which Android does not provide.
-dontwarn java.awt.Component
-dontwarn java.awt.GraphicsEnvironment
-dontwarn java.awt.HeadlessException
-dontwarn java.awt.Window

# After SDK/rule changes, inspect merged configuration.txt and AAB r8.json:
# shrinking/obfuscation/optimization must be enabled without global disable flags.
# Verify JNI constructors/callbacks, Expo reflection, BillingClient creation,
# Juicebox auth/HTTP callbacks, clean-data startup, and background communication.
# GPG needs both valid signed metadata/SHA256SUMS ASC and tampered-input rejection;
# the updater's legacy signed-JSON self-test is not a valid SHA256SUMS ASC fixture.
# Reused JS must match the verified flavor's main/bg/common/segments/module map.
# These checks do not replace real purchase/restore, live Juicebox recovery,
# Google login, full OTA/APK upgrade/rollback, or hardware-wallet acceptance.
