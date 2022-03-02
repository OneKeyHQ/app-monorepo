#include "validation.h"
#include <sys/system_properties.h>

// 查看签名信息：gradlew sR
// 签名信息
const char hexcode[] = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E',
                        'F'};

char *signatureSha1(JNIEnv *pInterface, jbyteArray pVoid);

/**
 * 获取 Android 系统版本
 * @return 系统版本号
 */
int currentAndroidOSVersion() {
    int version;

    char sdk_ver_str[8];
    if (__system_property_get("ro.build.version.sdk", sdk_ver_str)) {
        version = atoi(sdk_ver_str);
    } else {
        version = 0;
    }
    return version;
}

jbyteArray getSignatureSha1By1(JNIEnv *env, jobject context_object) {
    //上下文对象
    jclass context_class = (*env)->GetObjectClass(env, context_object);

    //反射获取PackageManager
    jmethodID methodId = (*env)->GetMethodID(env, context_class, "getPackageManager",
                                             "()Landroid/content/pm/PackageManager;");
    jobject package_manager = (*env)->CallObjectMethod(env, context_object, methodId);
    if (package_manager == NULL) {
        LOGD("package_manager is NULL!!!");
        return NULL;
    }

    //反射获取包名
    methodId = (*env)->GetMethodID(env, context_class, "getPackageName", "()Ljava/lang/String;");
    jstring package_name = (jstring)(*env)->CallObjectMethod(env, context_object, methodId);
    if (package_name == NULL) {
        LOGD("package_name is NULL!!!");
        return NULL;
    }
    (*env)->DeleteLocalRef(env, context_class);

    //获取PackageInfo对象
    jclass pack_manager_class = (*env)->GetObjectClass(env, package_manager);
    methodId = (*env)->GetMethodID(env, pack_manager_class, "getPackageInfo",
                                   "(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;");
    (*env)->DeleteLocalRef(env, pack_manager_class);
    jobject package_info = (*env)->CallObjectMethod(env, package_manager, methodId, package_name,
                                                    0x00000040);
    if (package_info == NULL) {
        LOGD("getPackageInfo() is NULL!!!");
        return NULL;
    }
    (*env)->DeleteLocalRef(env, package_manager);

    //获取签名信息
    jclass package_info_class = (*env)->GetObjectClass(env, package_info);
    jfieldID fieldId = (*env)->GetFieldID(env, package_info_class, "signatures",
                                          "[Landroid/content/pm/Signature;");
    (*env)->DeleteLocalRef(env, package_info_class);
    jobjectArray signature_object_array = (jobjectArray)(*env)->GetObjectField(env, package_info,
                                                                               fieldId);
    if (signature_object_array == NULL) {
        LOGD("signature is NULL!!!");
        return NULL;
    }
    jobject signature_object = (*env)->GetObjectArrayElement(env, signature_object_array, 0);
    (*env)->DeleteLocalRef(env, package_info);

    jclass signature_class = (*env)->GetObjectClass(env, signature_object);
    methodId = (*env)->GetMethodID(env, signature_class, "toByteArray", "()[B");
    (*env)->DeleteLocalRef(env, signature_class);
    jbyteArray signature_byte = (jbyteArray)(*env)->CallObjectMethod(env, signature_object,
                                                                     methodId);
    return signature_byte;
}

jbyteArray getSignatureSha1By28(JNIEnv *env, jobject context_object) {
    //上下文对象
    jclass context_class = (*env)->GetObjectClass(env, context_object);

    //反射获取PackageManager
    jmethodID methodId = (*env)->GetMethodID(env, context_class, "getPackageManager",
                                             "()Landroid/content/pm/PackageManager;");
    jobject package_manager = (*env)->CallObjectMethod(env, context_object, methodId);
    if (package_manager == NULL) {
        LOGD("package_manager is NULL!!!");
        return NULL;
    }

    //反射获取包名
    methodId = (*env)->GetMethodID(env, context_class, "getPackageName", "()Ljava/lang/String;");
    jstring package_name = (jstring)(*env)->CallObjectMethod(env, context_object, methodId);
    if (package_name == NULL) {
        LOGD("package_name is NULL!!!");
        return NULL;
    }
    (*env)->DeleteLocalRef(env, context_class);

    //获取PackageInfo对象
    jclass pack_manager_class = (*env)->GetObjectClass(env, package_manager);
    methodId = (*env)->GetMethodID(env, pack_manager_class, "getPackageInfo",
                                   "(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;");
    (*env)->DeleteLocalRef(env, pack_manager_class);
    jobject package_info = (*env)->CallObjectMethod(env, package_manager, methodId, package_name,
                                                    0x08000000);
    if (package_info == NULL) {
        LOGD("getPackageInfo() is NULL!!!");
        return NULL;
    }
    (*env)->DeleteLocalRef(env, package_manager);

    //获取SigningInfo对象
    jclass package_info_class = (*env)->GetObjectClass(env, package_info);
    jfieldID fieldId = (*env)->GetFieldID(env, package_info_class, "signingInfo",
                                          "Landroid/content/pm/SigningInfo;");
    (*env)->DeleteLocalRef(env, package_info_class);
    jobject signing_info = (jobjectArray)(*env)->GetObjectField(env, package_info,
                                                                fieldId);
    if (signing_info == NULL) {
        LOGD("signingInfo is NULL!!!");
        return NULL;
    }

    //获取签名信息
    jclass signing_info_class = (*env)->GetObjectClass(env, signing_info);
    methodId = (*env)->GetMethodID(env, signing_info_class, "getApkContentsSigners",
                                   "()[Landroid/content/pm/Signature;");
    (*env)->DeleteLocalRef(env, signing_info_class);
    jobjectArray signature_object_array = (jobjectArray)(*env)->CallObjectMethod(env, signing_info,
                                                                                 methodId);
    if (signature_object_array == NULL) {
        LOGD("signature is NULL!!!");
        return NULL;
    }
    jobject signature_object = (*env)->GetObjectArrayElement(env, signature_object_array, 0);
    (*env)->DeleteLocalRef(env, signing_info);

    jclass signature_class = (*env)->GetObjectClass(env, signature_object);
    methodId = (*env)->GetMethodID(env, signature_class, "toByteArray", "()[B");
    (*env)->DeleteLocalRef(env, signature_class);
    jbyteArray signature_byte = (jbyteArray)(*env)->CallObjectMethod(env, signature_object,
                                                                     methodId);
    return signature_byte;
}

char *getSignatureSha1(JNIEnv *env, jobject context_object) {

    LOGD("android version is %d", currentAndroidOSVersion());
    int version = currentAndroidOSVersion();
    jbyteArray signature_byte;
    if (version >= 28) {
        signature_byte = getSignatureSha1By28(env, context_object);
    } else {
        signature_byte = getSignatureSha1By1(env, context_object);
    }
    //签名信息转换成sha1值
    return signatureSha1(env, signature_byte);
}

char *signatureSha1(JNIEnv *env, jbyteArray message) {
    jclass byte_array_input_class = (*env)->FindClass(env, "java/io/ByteArrayInputStream");
    jmethodID methodId = (*env)->GetMethodID(env, byte_array_input_class, "<init>", "([B)V");
    jobject byte_array_input = (*env)->NewObject(env, byte_array_input_class, methodId,
                                                 message);
    jclass certificate_factory_class = (*env)->FindClass(env,
                                                         "java/security/cert/CertificateFactory");
    methodId = (*env)->GetStaticMethodID(env, certificate_factory_class, "getInstance",
                                         "(Ljava/lang/String;)Ljava/security/cert/CertificateFactory;");
    jstring x_509_jstring = (*env)->NewStringUTF(env, "X.509");
    jobject cert_factory = (*env)->CallStaticObjectMethod(env, certificate_factory_class, methodId,
                                                          x_509_jstring);
    methodId = (*env)->GetMethodID(env, certificate_factory_class, "generateCertificate",
                                   ("(Ljava/io/InputStream;)Ljava/security/cert/Certificate;"));
    jobject x509_cert = (*env)->CallObjectMethod(env, cert_factory, methodId, byte_array_input);
    (*env)->DeleteLocalRef(env, certificate_factory_class);
    jclass x509_cert_class = (*env)->GetObjectClass(env, x509_cert);
    methodId = (*env)->GetMethodID(env, x509_cert_class, "getEncoded", "()[B");
    jbyteArray cert_byte = (jbyteArray)(*env)->CallObjectMethod(env, x509_cert, methodId);
    (*env)->DeleteLocalRef(env, x509_cert_class);
    jclass message_digest_class = (*env)->FindClass(env, "java/security/MessageDigest");
    methodId = (*env)->GetStaticMethodID(env, message_digest_class, "getInstance",
                                         "(Ljava/lang/String;)Ljava/security/MessageDigest;");
    jstring sha1_jstring = (*env)->NewStringUTF(env, "SHA1");
    jobject sha1_digest = (*env)->CallStaticObjectMethod(env, message_digest_class, methodId,
                                                         sha1_jstring);
    methodId = (*env)->GetMethodID(env, message_digest_class, "digest", "([B)[B");
    jbyteArray sha1_byte = (jbyteArray)(*env)->CallObjectMethod(env, sha1_digest, methodId,
                                                                cert_byte);
    (*env)->DeleteLocalRef(env, message_digest_class);

    //转换成char
    jsize array_size = (*env)->GetArrayLength(env, sha1_byte);
    unsigned char *sha1 = (unsigned char *) (*env)->GetByteArrayElements(env, sha1_byte, 0);
    char *hex_sha = malloc(array_size * 2 + 1);
    for (int i = 0; i < array_size; ++i) {
        hex_sha[2 * i] = hexcode[(sha1[i]) / 16];
        hex_sha[2 * i + 1] = hexcode[(sha1[i]) % 16];
    }
    hex_sha[array_size * 2] = '\0';

    return hex_sha;
}

jboolean checkValidity(char *sha1, char * app_sha1[], size_t size) {
    //比较签名
    for (int i = 0; i < size; ++i) {
        const char *current = app_sha1[i];
        if (strcmp(sha1, current) == 0) {
            LOGD("signature is success.");
            return JNI_TRUE;
        }
    }
    LOGD("signature is error.");
    return JNI_FALSE;
}

jboolean checkSecurityPermission(JNIEnv *env, jobject contextObject, char * app_sha1[], size_t size) {
    char *sha1 = getSignatureSha1(env, contextObject);
    return checkValidity(sha1, app_sha1, size);
}