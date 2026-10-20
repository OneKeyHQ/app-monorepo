# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Nitro's generated JNI factories instantiate concrete HybridObjects by class name.
-keep class * extends com.margelo.nitro.core.HybridObject {
    public <init>();
}

# C++ resolves these callback interfaces and methods by their JVM names.
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
-keep class cn.jpush.** { *; }
-keep class cn.jiguang.** { *; }

# The bundled JCore disables its optional dynamic-loader branch.
-dontwarn cn.jiguang.dy.JDynamicLoadBase
# JNA resolves native callbacks and structure fields through reflection.
-keep class com.sun.jna.** { *; }
-keep class * extends com.sun.jna.** { *; }
# Realm's JNI_OnLoad resolves its TLS helper by this fixed class name.
-keep class io.realm.react.util.SSLHelper { *; }

# Juicebox's Rust JNI bridge resolves these DTOs and errors by JVM name.
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
-keepnames class org.bouncycastle.openpgp.*Exception

# BouncyCastle discovers these JCA services by name for RSA/SHA-2 GPG verification.
# Digest mappings derive implementation prefixes from the enclosing class name.
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
