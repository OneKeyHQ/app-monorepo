#include <string.h>
#include <alloca.h>
#include <jni.h>
#include "validation.h"

#if __has_include ("../../../../keys.secret")
#   define HAS_KEYS 1
#   include "../../../../keys.secret"
#else
#   define HAS_KEYS 0
#endif

JNIEXPORT jstring JNICALL
Java_so_onekey_app_wallet_keys_KeysNativeProvider_getLiteSecureChannelInitParams(JNIEnv *env,
                                                                                 jobject thiz,
                                                                                 jobject context) {
#if (HAS_KEYS == 1)
    if (checkSecurityPermission(env, context, (char **) authorizedAppSha1)) {
        return getDecryptedKey(env, liteInitGPCParams, sizeof(liteInitGPCParams));
    }
    LOGD("create process failure");
    exit(0);
    return (*env)->NewStringUTF(env,"");
#else
    return (*env)->NewStringUTF(env, "{\"scpID\":\"1107\",\"keyUsage\":\"3C\",\"keyType\":\"88\",\"keyLength\":16,\"hostID\":\"80\",\"crt\":\"20\",\"sk\":\"B6\",\"cardGroupID\":\"01020304\"}");
#endif
}