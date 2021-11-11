#ifndef JUB_GPC_APDU_SDK_H
#define JUB_GPC_APDU_SDK_H
//
// Generic helper definitions for shared library support
#if defined _MSC_VER || defined __CYGWIN__
    #define JUB_COINCORE_DLL_IMPORT extern "C" __declspec(dllimport)
    #define JUB_COINCORE_DLL_EXPORT extern "C" __declspec(dllexport)
    #define JUB_COINCORE_DLL_LOCAL
#else
    #if __GNUC__ >= 4
        #define JUB_COINCORE_DLL_IMPORT __attribute__((visibility("default")))
        #define JUB_COINCORE_DLL_EXPORT __attribute__((visibility("default")))
        #define JUB_COINCORE_DLL_LOCAL  __attribute__((visibility("internal")))
    #else
        #define JUB_COINCORE_DLL_IMPORT
        #define JUB_COINCORE_DLL_EXPORT
        #define JUB_COINCORE_DLL_LOCAL
    #endif // #if __GNUC__ >= 4
#endif // #if defined _MSC_VER || defined __CYGWIN__

// Tag to deprecate functions and methods.
// Gives a compiler warning when they are used.
#if defined _MSC_VER || defined __CYGWIN__
    #define BC_DEPRECATED __declspec(deprecated)
#else
    #if __GNUC__ >= 4
        #define JUB_DEPRECATED __attribute__((deprecated))
    #else
        #define JUB_DEPRECATED
    #endif // #if __GNUC__ >= 4
#endif // #if defined _MSC_VER || defined __CYGWIN__

// Avoid namespace conflict between boost::placeholders and std::placeholders.
#define BOOST_BIND_NO_PLACEHOLDERS

// Define so we can have better visibility of lcov exclusion ranges.
#define LCOV_EXCL_START(text)
#define LCOV_EXCL_STOP()

#if defined(_WIN32)
    #define HID_MODE
#elif defined(__APPLE__)
// see https://sourceforge.net/p/predef/mailman/message/34497133/
    #include <TargetConditionals.h>
    #if TARGET_OS_OSX // mac osx
        #define HID_MODE
    #elif TARGET_OS_IOS // ios
        #define BLE_MODE
        #define NFC_MODE
    #endif // #if TARGET_OS_OSX
#elif defined(__ANDROID__)
    #define BLE_MODE
    #define NFC_MODE
#else //other
    #define HID_MODE
#endif // #if defined(_WIN32)

#define JUBR_OK                     0x00000000UL

#define JUBR_ERROR                  0x00000001UL
#define JUBR_HOST_MEMORY            0x00000002UL
#define JUBR_ARGUMENTS_BAD          0x00000003UL
#define JUBR_IMPL_NOT_SUPPORT        0x00000004UL
#define JUBR_MEMORY_NULL_PTR        0x00000005UL
#define JUBR_CONTEXT_NOT_SATISFIED  0x00000006UL

#define JUBR_INVALID_MEMORY_PTR        0x00000008UL
#define JUBR_REPEAT_MEMORY_PTR        0x00000009UL
#define JUBR_BUFFER_TOO_SMALL        0x0000000AUL


/* === Library typedef: === */
#ifndef IN
    #define IN
#endif // #ifndef IN

#ifndef OUT
    #define OUT
#endif // #ifndef OUT

#ifndef INOUT
    #define INOUT
#endif // #ifndef INOUT

#define JUB_TRUE    1
#define JUB_FALSE   0

#ifndef JUB_DISABLE_TRUE_FALSE
    #ifndef FALSE
        #define FALSE JUB_FALSE
    #endif // #ifndef FALSE

    #ifndef TRUE
        #define TRUE JUB_TRUE
    #endif // #ifndef TRUE
#endif // #ifndef JUB_DISABLE_TRUE_FALSE

/* an unsigned 8-bit value */
typedef unsigned char JUB_BYTE;

/* an unsigned 8-bit character */
typedef JUB_BYTE JUB_UCHAR;

/* an unsigned/signed 8-bit character, decide by complie*/
typedef char JUB_CHAR;

/* an 8-bit UTF-8 character */
typedef JUB_BYTE JUB_UTF8UCHAR;

/* a BYTE-sized Boolean flag */
typedef JUB_BYTE JUB_BBOOL;

/* an unsigned value, at least 32 bits long */
typedef unsigned long int JUB_ULONG;

/* a signed value, the same size as a JUB_ULONG */
typedef signed long int  JUB_LONG;

typedef JUB_BYTE JUB_UINT8;

typedef unsigned int JUB_UINT32;

typedef unsigned short JUB_UINT16;

/* uint64 */
typedef unsigned long long JUB_UINT64;

/* signed uint64 */
typedef signed long long JUB_INT64;

#define JUB_PTR *
typedef JUB_CHAR JUB_PTR            JUB_CHAR_PTR;
typedef JUB_CHAR_PTR JUB_PTR        JUB_CHAR_PTR_PTR;
typedef const JUB_CHAR JUB_PTR      JUB_CHAR_CPTR;
typedef const JUB_BYTE JUB_PTR      JUB_BYTE_CPTR;

typedef JUB_BYTE JUB_PTR            JUB_BYTE_PTR;
typedef const JUB_BYTE JUB_PTR      JUB_BYTE_CPTR;
typedef JUB_UCHAR JUB_PTR           JUB_UCHAR_PTR;
typedef JUB_UTF8UCHAR JUB_PTR       JUB_UTF8UCHAR_PTR;
typedef JUB_ULONG JUB_PTR           JUB_ULONG_PTR;
typedef JUB_UINT16 JUB_PTR          JUB_UINT16_PTR;
typedef JUB_UINT32 JUB_PTR          JUB_UINT32_PTR;
typedef JUB_UINT64 JUB_PTR          JUB_UINT64_PTR;
typedef void JUB_PTR                JUB_VOID_PTR;

/* Pointer to a JUB_VOID_PTR-- i.e., pointer to pointer to void */
typedef JUB_VOID_PTR JUB_PTR JUB_VOID_PTR_PTR;

typedef JUB_ULONG JUB_RV;

#ifdef __cplusplus
extern "C" {
#endif // #ifdef __cplusplus


/**
 * SharedInfo.
*/
typedef struct JUB_GPC_SCP11_SHAREDINFO {
    JUB_CHAR_PTR scpID;     // SCP identifier and parameters in hex string
    JUB_CHAR_PTR keyUsage;  // Key Usage Qualifier in hex string, for SCP11c, it's '3C'
    JUB_CHAR_PTR keyType;   // Key Type in hex string, for SCP11c, it's '88' (AES)
    JUB_CHAR_PTR keyLength; // Key Length in hex string, it's '10'
    JUB_CHAR_PTR hostID;    // hostID in hex string, eg, "8080808080808080"
    JUB_CHAR_PTR cardGroupID;   // is the content of tag '5F20' (subject identifier) in CERT.SD.ECKA, eg, "6a75626974657277616c6c6574"
} GPC_SCP11_SHAREDINFO;


/*****************************************************************************
* @function name : JUB_FreeMemory
* @in  param : memPtr
* @out param :
* @last change :
*****************************************************************************/
JUB_RV JUB_FreeMemory(IN JUB_CHAR_CPTR memPtr);


/*****************************************************************************
 * @function name : JUB_GPC_TLVDecode
 * @in  param : tlv - TLV
 *           tag - tag
 * @out param : value - value
 * @last change :
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_TLVDecode(IN JUB_CHAR_CPTR tlv,
                         OUT JUB_ULONG_PTR tag,
                         OUT JUB_CHAR_PTR_PTR value);


/*****************************************************************************
 * @function name : JUB_GPC_Initialize
 * @in  param : sharedInfo - SCP11 sharedInfo
 *           oce_crt - OCE certificate in hex string
 *           e_rk - Ephemeral private key of the OCE used for key agreement in hex string, ecdsa private key, length = 32
 * @out param :
 * @last change :
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_Initialize(IN GPC_SCP11_SHAREDINFO &sharedInfo,
                          IN JUB_CHAR_CPTR oce_crt,
                          IN JUB_CHAR_CPTR oce_rk);


/*****************************************************************************
 * @function name : JUB_GPC_Finalize
 * @in  param :
 * @out param :
 * @last change :
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_Finalize();


/*****************************************************************************
 * @function name : JUB_GPC_BuildMutualAuthData
 * @in  param :
 * @out param : apduData - APDU data for MutualAuth cmd in hex string
 * @last change :
 * @ condition: JUB_GPC_Initialize() has been called first.
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_BuildMutualAuthData(OUT JUB_CHAR_PTR_PTR apduData);


/*****************************************************************************
 * @function name : JUB_GPC_OpenSecureChannel
 * @in  param : response - response from Mutual Auth command in hex string
 * @out param :
 * @last change :
 * @ condition: JUB_GPC_Initialize() has been called first.
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_OpenSecureChannel(IN JUB_CHAR_CPTR response);


/*****************************************************************************
 * @function name : JUB_GPC_BuildAPDU
 * @in  param : cla - Class byte of the command message
 *           ins - Instruction byte of the command message
 *           p1 - Reference control parameter 1
 *           p2 - Reference control parameter 2
 *           data - APDU data in hex string
 * @out param : apdu - APDU in plain text
 * @last change :
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_BuildAPDU(IN JUB_ULONG cla, IN JUB_ULONG ins,
                         IN JUB_ULONG p1,  IN JUB_ULONG p2,
                         IN JUB_CHAR_CPTR data,
                         OUT JUB_CHAR_PTR_PTR apdu);


/*****************************************************************************
 * @function name : JUB_GPC_ParseAPDUResponse
 * @in  param : response - command response in hex string
 * @out param : pwRet - APDU response
 *            resp - APDU response data
 * @last change :
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_ParseAPDUResponse(IN JUB_CHAR_CPTR response,
                                 OUT JUB_UINT16_PTR pwRet,
                                 OUT JUB_CHAR_PTR_PTR resp);


/*****************************************************************************
 * @function name : JUB_GPC_BuildSafeAPDU
 * @in  param : cla - Class byte of the command message
 *           ins - Instruction byte of the command message
 *           p1 - Reference control parameter 1
 *           p2 - Reference control parameter 2
 *           data - APDU data in hex string
 * @out param : safeApdu - APDU in cipher text
 * @last change :
 * @ condition: JUB_GPC_Initialize() has been called first.
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_BuildSafeAPDU(IN JUB_ULONG cla, IN JUB_ULONG ins,
                             IN JUB_ULONG p1,  IN JUB_ULONG p2,
                             IN JUB_CHAR_CPTR data,
                             OUT JUB_CHAR_PTR_PTR safeApdu);


/*****************************************************************************
 * @function name : JUB_GPC_ParseSafeAPDUResponse
 * @in  param : response - command response in hex string
 * @out param : pwRet - APDU response
 *            decResp - APDU response data in plain text
 * @last change :
 * @ condition: JUB_GPC_Initialize() has been called first.
*****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_ParseSafeAPDUResponse(IN JUB_CHAR_CPTR response,
                                     OUT JUB_UINT16_PTR pwRet,
                                     OUT JUB_CHAR_PTR_PTR decResp);


/*****************************************************************************
 * @function name : JUB_GPC_ParseCertificate
 * @in  param : cert - certificate of a device
 * @out param : sn - Certificate Serial Number
 *           : subjectID - Subject Identifier in hex
 * @last change :
 *****************************************************************************/
JUB_COINCORE_DLL_EXPORT
JUB_RV JUB_GPC_ParseCertificate(IN JUB_CHAR_CPTR cert,
                                OUT JUB_CHAR_PTR_PTR sn,
                                OUT JUB_CHAR_PTR_PTR subjectID);

#ifdef __cplusplus
}
#endif // #ifdef __cplusplus
#endif /* JUB_GPC_APDU_SDK_H */
