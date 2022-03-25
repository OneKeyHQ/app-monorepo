package so.onekey.app.wallet.onekeyLite

import android.nfc.tech.IsoDep
import android.util.Log
import org.haobtc.onekey.card.gpchannel.GPChannelNatives
import so.onekey.app.wallet.keys.KeysNativeProvider
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.onekeyLite.entitys.CardResponse
import so.onekey.app.wallet.onekeyLite.entitys.ParsedCertInfo
import so.onekey.app.wallet.onekeyLite.entitys.SecureChanelParam
import so.onekey.app.wallet.utils.HexUtils
import so.onekey.app.wallet.utils.Utils
import java.io.IOException

/**
 *
 * @Author:         peter Qin
 *
 */
class NfcCommand {


    companion object {
        const val MNEMONIC = "mnemonics"
        const val MODE = "statusMode"
        const val SELECT_CARD_ID = "select_card_id"
        const val VERIFY_SUCCESS = 100
        const val INTERRUPT_STATUS = 1000
        const val RESET_INTERRUPT_STATUS = 1001
        const val GET_RETRY_NUM_INTERRUPT_STATUS = 1002
        const val RESET_PIN_SUCCESS = -1
        const val CHANGE_PIN_SUCCESS = -10
        const val CHANGE_PIN_ERROR = -100
        const val NEW_PIN = "029000"
        const val MAX_RETRY_NUM = 10
        const val NO_RETRY_NUM_RESET_CARD = 0
        const val NOT_MATCH_DEVICE = "cannot_match_device"
        const val INIT_CHANNEL_SUCCESS = 104
        const val INIT_CHANNEL_FAILURE = 105
        const val STATUS_SUCCESS = "9000"
        const val HAS_BACK_UP = "029000"
        const val LITE_VERSION = "01"
        const val LITE_LANGUAGE = "00"// english
        const val LITE_TAG = "ffff"

        @JvmStatic
        fun verifyPinCommand(string: String?): String? {
            return GPChannelNatives.nativeGPCBuildSafeAPDU(
                0x80, 0x20, 0x00, 0x00, "06" + HexUtils.stringToHexString(string)
            )
        }

        @JvmStatic
        fun setPinCommand(string: String?): String? {
            return GPChannelNatives.nativeGPCBuildSafeAPDU(
                0x80,
                0xCB,
                0x80,
                0x00,
                "DFFE0B8204080006"
                        + HexUtils.stringToHexString(
                    string
                )
            )
        }

        private fun combCommand(command: ByteArray? = null, vararg params: ByteArray?): ByteArray {
            var combParam = byteArrayOf()
            params.forEach { param ->
                param?.let {
                    combParam = combParam.plus(it.size.toByte())
                    combParam = combParam.plus(it)
                }
            }

            var combCommand = byteArrayOf()
            command?.let {
                combCommand = combCommand.plus(it)
                if (params.size != 1) {
                    // params 只有一个的时候就不再次拼接长度了
                    combCommand = combCommand.plus(combParam.size.toByte())
                }
            }
            combCommand = combCommand.plus(combParam)
            return combCommand
        }

        private fun changePinCommand(oldPin: String?, newPin: String?): String? {
            val changePinCommand = combCommand(
                HexUtils.hexString2Bytes("8204"),
                HexUtils.hexString2Bytes(HexUtils.stringToHexString(oldPin)),
                HexUtils.hexString2Bytes(HexUtils.stringToHexString(newPin))
            )

            val execCommand = combCommand(HexUtils.hexString2Bytes("DFFE"), changePinCommand)

            return GPChannelNatives.nativeGPCBuildSafeAPDU(
                0x80,
                0xCB,
                0x80,
                0x00,
                HexUtils.byteArr2HexStr(execCommand)
            )
        }

        @JvmStatic
        fun backupCommand(mnemonic: String?): String? {
            return GPChannelNatives.nativeGPCBuildAPDU(
                0x80,
                0x3B,
                0x00,
                0x00,
                mnemonic
            )
        }

        @JvmStatic
        fun isNewCardCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(
                0x80, 0xCB, 0x80, 0x00, "DFFF028105"
            )
        }


        @JvmStatic
        fun getCardSerialNumCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(0x80, 0xCB, 0x80, 0x00, "DFFF028101")
        }

        @JvmStatic
        fun hasBackUpCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(0x80, 0x6A, 0x00, 0x00, "")
        }

        @JvmStatic
        fun selectAppCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(
                0x00, 0xA4, 0x04, 0x00, "D156000132834001"
            )
        }

        @JvmStatic
        fun getCenterCardCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(0x80, 0xCA, 0xBF, 0x21, "A60483021518")
        }

        @JvmStatic
        fun getSNCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(0x80, 0xCB, 0x80, 0x00, "DFFF028101")
        }

        @JvmStatic
        fun selectSdCommand(): String {
            return GPChannelNatives.nativeGPCBuildAPDU(
                0x00, 0xA4, 0x04, 0x00, ""
            )
        }

        @JvmStatic
        fun exportCommand(isoDep: IsoDep?): String? {
            val export = GPChannelNatives.nativeGPCBuildAPDU(
                0x80,
                0x4B,
                0x00,
                0x00, ""
            )
            val sendResult = send(isoDep, export)
            if (sendResult.isNullOrEmpty() || !sendResult.endsWith(STATUS_SUCCESS)) {
                return null
            }
            return exportSeed(sendResult)
        }

        @JvmStatic
        fun verifyPinInitCommand(isoDep: IsoDep): Boolean {
            val selected: Boolean = selectBackupApp(isoDep)
            if (!selected) {
                return false
            }
            // 开启安全通道并验证PIN
            return !openSecureChannelFailed(isoDep)
        }

        @JvmStatic
        fun startVerifyPinCommand(isoDep: IsoDep, verifyPin: String): Int {
            // 验证PIN
            val verify: String? =
                verifyPinCommand(verifyPin)
            val response = send(isoDep, verify)
            return if (response == null) {
                INTERRUPT_STATUS
            } else if (response.endsWith(STATUS_SUCCESS)) {
                Log.d(LITE_TAG, "---verify success")
                VERIFY_SUCCESS
            } else {
                retryNumCommandAndReset(isoDep)
            }
        }

        @JvmStatic
        fun startBackupCommand(isoDep: IsoDep, isBackupApp: Boolean, mnemonic: String?): Boolean {
            if (!isBackupApp) {
                val selected: Boolean = selectBackupApp(isoDep)
                if (!selected) {
                    return false
                }
                if (openSecureChannelFailed(isoDep)) {
                    return false
                }
            }
            val importSeed = backupCommand(mnemonic)
            val res = send(isoDep, importSeed)
            Log.d(LITE_TAG, "Backup Command-->$res")
            return if (res.isNullOrEmpty()) {
                false
            } else {
                res.endsWith(STATUS_SUCCESS)
            }
        }

        @JvmStatic
        fun setupPinCommand(isoDep: IsoDep, setUpPin: String): Boolean {
            val initChannelResult = initChannel(isoDep)
            if (initChannelResult != INIT_CHANNEL_SUCCESS) {
                throw NFCExceptions.InterruptException()
            }
            if (!selectIssuerSd(isoDep)) {
                throw NFCExceptions.InterruptException()
            }
            if (openSecureChannelFailed(isoDep)) {
                throw NFCExceptions.InterruptException()
            }

            val changePin: String? =
                setPinCommand(setUpPin)
            val res = send(isoDep, changePin)
            Log.d(LITE_TAG, " set Pin command result --->$res")
            return if (res.isNullOrEmpty()) {
                false
            } else {
                res.endsWith(STATUS_SUCCESS)
            }
        }

        @JvmStatic
        @Throws(NFCExceptions::class)
        fun changePinCommand(isoDep: IsoDep, oldPin: String, newPin: String?): Int {
            val initChannelResult = initChannel(isoDep)
            if (initChannelResult != INIT_CHANNEL_SUCCESS) {
                throw NFCExceptions.InterruptException()
            }
            if (!selectIssuerSd(isoDep)) {
                throw NFCExceptions.InterruptException()
            }
            if (openSecureChannelFailed(isoDep)) {
                throw NFCExceptions.InterruptException()
            }
            val changePin: String? =
                changePinCommand(oldPin, newPin)

            val res = send(isoDep, changePin)
            Log.d(LITE_TAG, " set Pin command result --->$res")

            if (res?.endsWith("9B01") == true) {
                // 原密码错误
                return retryNumCommandAndReset(isoDep)
            }
            return if (res.isNullOrEmpty() || !res.endsWith(STATUS_SUCCESS)) {
                CHANGE_PIN_ERROR
            } else {
                CHANGE_PIN_SUCCESS
            }
        }

        @JvmStatic
        fun clearBackup(isoDep: IsoDep): Boolean {
            if (openSecureChannelFailed(isoDep)) {
                return false
            }
            val clearStatus =
                GPChannelNatives.nativeGPCBuildAPDU(0x80, 0x7A, 0x00, 0x00, "")
            val res = send(isoDep, clearStatus)
            Log.d(LITE_TAG, "----clearBackUpStatus-->$res")
            return if (res.isNullOrEmpty()) {
                false
            } else {
                res.endsWith(STATUS_SUCCESS)
            }
        }

        fun getRetryCount(isoDep: IsoDep): Int {
            if (!selectIssuerSd(isoDep)) {
                return GET_RETRY_NUM_INTERRUPT_STATUS
            }
            val getRetryMaxNumCommand =
                GPChannelNatives.nativeGPCBuildAPDU(0x80, 0xCB, 0x80, 0x00, "DFFF028102")
            val retryMaxNum = send(isoDep, getRetryMaxNumCommand)
            if (retryMaxNum.isNullOrEmpty() || !retryMaxNum.endsWith(STATUS_SUCCESS)) {
                return GET_RETRY_NUM_INTERRUPT_STATUS
            }
            Log.d(LITE_TAG, "getRetryNum String-->${retryMaxNum}")
            val leftRetryNum = retryMaxNum[1].digitToInt(16)
            Log.d(LITE_TAG, "getRetryNum-->${leftRetryNum}")
            return leftRetryNum
        }

        private fun retryNumCommandAndReset(isoDep: IsoDep): Int {
            val leftRetryNum = getRetryCount(isoDep)
            return if (leftRetryNum == 0) {
                resetCommand(isoDep)
            } else {
                leftRetryNum
            }
        }


        // clear Pin function
        fun resetCommand(isoDep: IsoDep): Int {
            val selected = selectIssuerSd(isoDep)
            if (!selected) {
                return RESET_INTERRUPT_STATUS
            }
            if (openSecureChannelFailed(isoDep)) {
                return RESET_INTERRUPT_STATUS
            }
            val clearStatus =
                GPChannelNatives.nativeGPCBuildSafeAPDU(0x80, 0xCB, 0x80, 0x00, "DFFE028205")
            val res = send(isoDep, clearStatus)
            return if (res?.endsWith(STATUS_SUCCESS) == true) {
                RESET_PIN_SUCCESS
            } else {
                RESET_INTERRUPT_STATUS
            }
        }


        @JvmStatic
        // 主安全域
        fun selectIssuerSd(isoDep: IsoDep): Boolean {
            try {
                val selectSd: String? = selectSdCommand()
                val res: String? = send(isoDep, selectSd)
                Log.d(LITE_TAG, "-----$res")
                if (res.isNullOrEmpty()) {
                    return false
                }
                return res.endsWith(STATUS_SUCCESS)
            } catch (e: Throwable) {
                return false
            }
        }


        @JvmStatic
        fun verifyDeviceSN(isoDep: IsoDep): String? {
            val success = selectIssuerSd(isoDep)
            Log.d(LITE_TAG, " selectIssuerSd ---->$success")
            if (!success) {
                return null
            }
            val cardId = getCardCert(isoDep)
            if (cardId.isNullOrEmpty()) {
                return NOT_MATCH_DEVICE
            }
            val cert = GPChannelNatives.nativeGPCParseCertificate(cardId)
            val certInfo = ParsedCertInfo.objectFromData(cert)
            return certInfo.getSubjectID()
        }

        @JvmStatic
        fun initChannel(isoDep: IsoDep): Int {
            val groupId = verifyDeviceSN(isoDep)
            val cardInfo = getCardName(isoDep)

            Log.d(LITE_TAG, " init_channel groupId-->$groupId")
            Log.d(LITE_TAG, " init_channel cardInfo-->$cardInfo")
            if (groupId.isNullOrEmpty() || cardInfo.isEmpty()) {
                return INIT_CHANNEL_FAILURE
            }
            if (groupId == NOT_MATCH_DEVICE || cardInfo == NOT_MATCH_DEVICE) {
                return INIT_CHANNEL_FAILURE
            }
            // 1. 初始化安全通道设置
            val param = SecureChanelParam.objectFromData(
                KeysNativeProvider().getLiteSecureChannelInitParams(Utils.getApp())
            )
            param.cardGroupID = groupId
            val status1 = GPChannelNatives.nativeGPCInitialize(param.toString())
            return if (status1 != 0) {
                INIT_CHANNEL_FAILURE
            } else {
                INIT_CHANNEL_SUCCESS
            }
        }

        @JvmStatic
        fun getCardName(isoDep: IsoDep): String {
            val getSNCommand = getSNCommand()
            var res: String? = send(isoDep, getSNCommand)
            if (res.isNullOrEmpty()) {
                return NOT_MATCH_DEVICE
            }
            if (res.length > 4 && res.endsWith(STATUS_SUCCESS)) {
                res = res.substring(0, res.length - 4)
                return String(HexUtils.hexString2Bytes(res))
            }
            return NOT_MATCH_DEVICE
        }


        private fun exportSeed(originSeedString: String): String? {
            val originResponse = GPChannelNatives.nativeGPCParseAPDUResponse(
                originSeedString
            )
            val response = CardResponse.objectFromData(
                originResponse
            )
                .response
            Log.d(LITE_TAG, "---origin-->$response")
            return response
        }

        @JvmStatic
        fun getCardCert(isoDep: IsoDep?): String? {
            // #1.NFC:GET CERT.SD.ECKA 获取智能卡证书
            val getCertCommand = getCenterCardCommand()
            val rawCert = send(isoDep, getCertCommand)
            if (rawCert.isNullOrEmpty()) {
                return null
            }
            if (!rawCert.endsWith(STATUS_SUCCESS) || rawCert.length < 4) {
                return null
            }
            var cert: String? = rawCert.substring(0, rawCert.length - 4)
            Log.d(LITE_TAG, "getCardCert---->$cert")
            cert = GPChannelNatives.nativeGPCTLVDecode(cert)
            return CardResponse.objectFromData(cert).response

        }


        private fun openSecureChannelFailed(isoDep: IsoDep): Boolean {
            val param = KeysNativeProvider().getLiteSecureChannelInitParams(Utils.getApp())
            val chanelParam = SecureChanelParam.objectFromData(param)
            // prepare to open secure channel
            val step1 = GPChannelNatives.nativeGPCBuildAPDU(0x80, 0x2A, 0x18, 0x10, chanelParam.crt)
            // 0x80, 0x82, 0x18, 0x15
            val res1 = send(isoDep, step1)
            if (res1.isNullOrEmpty()) {
                return true
            }
            val authData = GPChannelNatives.nativeGPCBuildMutualAuthData()
            val step2 = GPChannelNatives.nativeGPCBuildAPDU(0x80, 0x82, 0x18, 0x15, authData)
            val authRes = send(isoDep, step2)
            if (authRes.isNullOrEmpty()) {
                return true
            }
            val res =
                CardResponse.objectFromData(GPChannelNatives.nativeGPCParseAPDUResponse(authRes))
                    .response
            val status = GPChannelNatives.nativeGPCOpenSecureChannel(res)
            if (status != 0) {
                return true
            }
            return false
        }

        @JvmStatic
        fun selectBackupApp(isoDep: IsoDep): Boolean {
            val selectApp = selectAppCommand()
            val res = send(isoDep, selectApp)
            if (res.isNullOrEmpty()) {
                return false
            }
            return STATUS_SUCCESS == res
        }


        @JvmStatic
        fun send(isoDep: IsoDep?, request: String?): String? {
            val response: String?
            try {
                if (isoDep?.isConnected == false) {
                    isoDep.connect()
                    isoDep.timeout = 4000
                }
                response =
                    HexUtils.byteArr2HexStr(isoDep?.transceive(HexUtils.hexString2Bytes(request)))
            } catch (e: IOException) {
                e.printStackTrace()
                return null
            }
            return response
        }
    }
}
