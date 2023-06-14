package so.onekey.app.wallet.onekeyLite.entitys

import so.onekey.app.wallet.utils.HexUtils

data class SendResponse(
    // Original return result
    val rawResponse: String,
    val sw1: Byte,
    val sw2: Byte,
    val data: String? = null,
    // Processed result
    var result: String? = null
) {
    fun isSuccess() = sw1 == 0x90.toByte() && sw2 == 0x00.toByte()

    fun isConnectFailure() = sw1 == 0x6F.toByte() && sw2 == 0x00.toByte()

    fun isEmptyData() = data.isNullOrEmpty()

    fun getCodeBytes(): ByteArray = byteArrayOf(sw1, sw2)

    fun getCode(): String = HexUtils.byteArr2HexStr(byteArrayOf(sw1, sw2))

    fun getDataBytes(): ByteArray? =
        if (isEmptyData()) null else HexUtils.hexString2Bytes(data)
}