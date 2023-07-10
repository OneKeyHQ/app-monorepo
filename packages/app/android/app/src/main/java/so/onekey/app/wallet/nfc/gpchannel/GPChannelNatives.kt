package org.haobtc.onekey.card.gpchannel

/** @Date 2020-07-09 16:29 @Author li @Version 1.0
 */
object GPChannelNatives {
    /**
     * 当native接口的返回值不是int时，需要调用该接口获取错误码
     *
     * @return
     */
    external fun nativeGetErrorCode(): Int
    external fun nativeGPCInitialize(json: String?): Int
    external fun nativeGPCFinalize(): Int
    external fun nativeGPCBuildMutualAuthData(): String
    external fun nativeGPCOpenSecureChannel(response: String?): Int
    external fun nativeGPCBuildAPDU(
        cla: Long, ins: Long, p1: Long, p2: Long, data: String = ""
    ): String

    external fun nativeGPCBuildSafeAPDU(
        cla: Long, ins: Long, p1: Long, p2: Long, data: String = ""
    ): String

    external fun nativeGPCParseSafeAPDUResponse(response: String?): String
    external fun nativeGPCParseAPDUResponse(response: String?): String
    external fun nativeGPCTLVDecode(apdu: String?): String
    external fun nativeGPCParseCertificate(cert: String?): String

    init {
        System.loadLibrary("gpchannelNDK")
    }
}