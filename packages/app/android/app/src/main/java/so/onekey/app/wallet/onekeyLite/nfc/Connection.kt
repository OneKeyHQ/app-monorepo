package so.onekey.app.wallet.onekeyLite.nfc

import android.nfc.tech.IsoDep
import org.haobtc.onekey.card.gpchannel.GPChannelNatives
import org.haobtc.onekey.card.gpchannel.GPChannelNatives.nativeGPCFinalize
import so.onekey.app.wallet.keys.KeysNativeProvider
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.onekeyLite.NfcConstant
import so.onekey.app.wallet.onekeyLite.entitys.*
import so.onekey.app.wallet.onekeyLite.nfc.GPCAPDUGenerator.buildGPCAPDU
import so.onekey.app.wallet.onekeyLite.nfc.GPCAPDUGenerator.combCommand
import so.onekey.app.wallet.utils.HexUtils
import so.onekey.app.wallet.utils.HexUtils.byteArr2HexStr
import so.onekey.app.wallet.utils.HexUtils.hexString2Bytes
import so.onekey.app.wallet.utils.LogUtil.printLog
import so.onekey.app.wallet.utils.Utils
import java.io.IOException

class Connection(val isoDep: IsoDep, private val mCommandGenerator: CommandGenerator) {
    companion object {
        private const val TAG = "Connection"

        @JvmStatic
        private fun connect(isoDep: IsoDep?) {
            if (isoDep?.isConnected == false) {
                isoDep.connect()
                isoDep.timeout = 15000
            }
        }

        @JvmStatic
        fun send(isoDep: IsoDep, request: String?): SendResponse {
            try {
                connect(isoDep)
                val response = isoDep.transceive(hexString2Bytes(request)) ?: byteArrayOf(
                    0xFF.toByte(), 0xFF.toByte()
                )
                val resp: ByteArray = if (response.size > 2) {
                    response.copyOfRange(0, response.size - 2)
                } else byteArrayOf()
                val sw1 = response[response.size - 2]
                val sw2 = response[response.size - 1]

                return SendResponse(byteArr2HexStr(response), sw1, sw2, byteArr2HexStr(resp))
            } catch (e: IOException) {
                e.printStackTrace()
                return SendResponse("0xFFFF", 0xFF.toByte(), 0xFF.toByte())
            }
        }
    }

    private var mCardType: AppleCardType = AppleCardType.V2
    private var mCardSerialNumber: String = NfcConstant.NOT_MATCH_DEVICE
    private var hasOpenSafeChannel: Boolean = false
    private var hasSetupPin: Boolean = false
    private var hasBackup: Boolean = false
    private var mCommandArea = CommandArea.None

    init {
        readCardInfo()
    }

    fun getCardType(): AppleCardType {
        return mCardType
    }

    fun getCurrentCommandArea(): CommandArea {
        return mCommandArea
    }

    fun selectPrimarySafety(): Boolean {
        printLog(TAG, "---> selectPrimarySafety begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.SELECT_PRIMARY_SAFETY, hasOpenSafeChannel,
        )
        val res = command.send(this)
        printLog(
            TAG, "<--- selectPrimarySafety end: ${res.getCode()} ${res.data} area:${mCommandArea}"
        )

        if (res.isSuccess() && !res.isEmptyData()) {
            mCommandArea = CommandArea.PrimarySafety
            return true
        }
        return false
    }

    fun selectBackupApplet(cardType: AppleCardType?): Boolean {
        printLog(TAG, "---> selectApplet begin")
        val command = mCommandGenerator.generalCommand(
            cardType ?: mCardType,
            CommandType.SELECT_BACKUP_APPLET,
            hasOpenSafeChannel,
            cardType?.aid ?: mCardType.aid
        )
        val res = command.send(this)

        printLog(TAG, "<--- selectApplet end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (res.isSuccess()) {
            mCommandArea = CommandArea.BackupApplet
            return true
        }
        return false
    }

    private fun getDeviceCertificate(): ParsedCertInfo? {
        printLog(TAG, "---> getDeviceCertificate begin")
        // #1.NFC:GET CERT.SD.ECKA 获取智能卡证书
        val apdu = buildGPCAPDU(APDUParam(0x80, 0xCA, 0xBF, 0x21, "A60483021518"))
        val rawCert = send(isoDep, apdu)
        printLog(
            TAG,
            "<--- getDeviceCertificate end: ${rawCert.getCode()} ${rawCert.data} area:${mCommandArea}"
        )

        val cert = GPChannelNatives.nativeGPCTLVDecode(rawCert.data)
        val certificate = CardResponse.objectFromData(cert).response

        val certInfo = GPChannelNatives.nativeGPCParseCertificate(certificate)
        return ParsedCertInfo.objectFromData(certInfo)
    }

    fun openSafeChannel(): Boolean {
        printLog(TAG, "---> openSafeChannel begin")

        if (hasOpenSafeChannel) {
            printLog(TAG, "<--- has open safe channel")
            return true
        }

        printLog(TAG, "0. ---> getDeviceCertificate begin")
        val certInfo = getDeviceCertificate() ?: return false
        printLog(TAG, "0. <--- getDeviceCertificate end: ${certInfo.subjectID}")

        printLog(TAG, "1. ---> nativeGPCInitialize begin")
        val param = SecureChanelParam.objectFromData(
            KeysNativeProvider().getLiteSecureChannelInitParams(Utils.getApp())
        )
        param.cardGroupID = certInfo.subjectID
        printLog(TAG, "nativeGPCInitialize read param done")
        val initializeStatus = GPChannelNatives.nativeGPCInitialize(param.toString())
        if (initializeStatus != 0) {
            return false
        }
        printLog(TAG, "1. <--- nativeGPCInitialize end")

        printLog(TAG, "2. ---> Perform security operation begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.VERIFY_CERTIFICATE, hasOpenSafeChannel, param.crt
        )
        val securityRes = command.send(this)
        printLog(
            TAG,
            "2. <--- Perform security operation end: ${securityRes.getCode()} ${securityRes.data}"
        )
        if (!securityRes.isSuccess()) {
            return false
        }

        printLog(TAG, "3. ---> mutual authenticate begin")
        val authData = GPChannelNatives.nativeGPCBuildMutualAuthData()
        printLog(TAG, "mutual authenticate data")
        val authCommand = mCommandGenerator.generalCommand(
            mCardType, CommandType.VERIFY_AUTH_DATA, hasOpenSafeChannel, authData
        )
        val authRes = authCommand.send(this)
        printLog(TAG, "3. <--- mutual authenticate end")
        if (authRes.isEmptyData() || !authRes.isSuccess()) {
            return false
        }

        printLog(TAG, "4. ---> open secure channel begin")
        val openStatus = GPChannelNatives.nativeGPCOpenSecureChannel(authRes.result)
        if (openStatus != 0) {
            return false
        }
        printLog(TAG, "4. <--- open secure channel end")

        printLog(TAG, "<--- openSafeChannel end: Open Secure Channel OK")

        hasOpenSafeChannel = true
        return true
    }

    fun resetSecureChannel(): Boolean {
        printLog(TAG, "---> resetSecureChannel begin")
        nativeGPCFinalize()
        hasOpenSafeChannel = false
        printLog(TAG, "<--- resetSecureChannel end")
        return true
    }

    private fun loadBackupStatus(): Boolean {
        printLog(TAG, "---> getBackupStatus begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.GET_BACKUP_STATUS, hasOpenSafeChannel
        )
        val res = command.send(this)
        printLog(TAG, "<--- getBackupStatus end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (!res.isSuccess()) {
            return false
        }

        return (res.data == "02").also { hasBackup = it }
    }

    private fun loadPinStatus(): Boolean {
        printLog(TAG, "---> getPinStatus begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.GET_PIN_STATUS, hasOpenSafeChannel, "DFFF028105"
        )
        val res = command.send(this)
        printLog(TAG, "<--- getPinStatus end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (!res.isSuccess()) {
            return false
        }

        val notSetPin = res.data == "02"
        hasSetupPin = !notSetPin
        return notSetPin
    }

    private fun loadSerialNumber(cardType: AppleCardType? = null): String {
        printLog(TAG, "---> getSerialNumber begin")
        val command = mCommandGenerator.generalCommand(
            cardType ?: mCardType, CommandType.GET_SERIAL_NUMBER, hasOpenSafeChannel, "DFFF028101"
        )
        val res = command.send(this)

        printLog(TAG, "<--- getSerialNumber end: ${res.getCode()} ${res.data} area:${mCommandArea}")
        if (!res.isSuccess()) {
            return NfcConstant.NOT_MATCH_DEVICE
        }

        return String(hexString2Bytes(res.data)).also {
            mCardSerialNumber = it
        }
    }

    private fun getRetryCount(): Int {
        printLog(TAG, "---> getRetryNum begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.GET_PIN_RETRY_COUNT, hasOpenSafeChannel, "DFFF028102"
        )
        val res = command.send(this)

        printLog(TAG, "<--- getRetryNum end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (res.isEmptyData() || !res.isSuccess()) {
            return NfcConstant.GET_RETRY_NUM_INTERRUPT_STATUS
        }
        return res.data?.toInt(16) ?: NfcConstant.GET_RETRY_NUM_INTERRUPT_STATUS
    }

    private fun readCardInfo() {
        printLog(TAG, "---> initCard begin")
        try {
            val cardTypes = arrayOf(AppleCardType.V1, AppleCardType.V2)
            for (cardType in cardTypes) {
                printLog(TAG, "---->> selectApplet: $cardType")
                val serialNumber = loadSerialNumber(cardType)
                if (serialNumber.startsWith(cardType.prefixSN)) {
                    mCardType = cardType
                    break
                }
            }
        } catch (e: NFCExceptions) {
            printLog(TAG, " init_channel NFCExceptions-->$e")
        }

        loadPinStatus()
        if (mCardType == AppleCardType.V2) {
            loadBackupStatus()
        } else {
            hasBackup = hasSetupPin
        }
        printLog(TAG, "<--- initCard end")
    }

    fun getCardInfo(): CardState {
        val retryCount = getRetryCount()
        return CardState(hasBackup, !hasSetupPin, mCardSerialNumber, retryCount)
    }

    fun getSerialNumber() = mCardSerialNumber

    fun setupNewPin(pin: String): Boolean {
        printLog(TAG, "---> setupNewPin begin")
        val pinHex = HexUtils.stringToHexString(pin)
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.SETUP_NEW_PIN, hasOpenSafeChannel, "DFFE0B8204080006$pinHex"
        )
        val res = command.send(this)
        printLog(TAG, "<--- setupNewPin end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (!res.isSuccess()) {
            return false
        }

        return true
    }

    fun changePin(oldPin: String, newPin: String?): Int {
        printLog(TAG, "---> changePin begin")
        val oldPinHex = HexUtils.stringToHexString(oldPin)
        val newPinHex = HexUtils.stringToHexString(newPin)
        val changePinCommand = combCommand(
            hexString2Bytes("8204"), hexString2Bytes(oldPinHex), hexString2Bytes(newPinHex)
        )
        val execCommand = combCommand(hexString2Bytes("DFFE"), changePinCommand)

        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.CHANGE_PIN, hasOpenSafeChannel, byteArr2HexStr(execCommand)
        )
        val res = command.send(this)

        printLog(TAG, "<--- changePin end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        return if (res.isConnectFailure()) {
            NfcConstant.INTERRUPT_STATUS
        } else if (res.isSuccess()) {
            printLog(TAG, "--- verify success")
            NfcConstant.CHANGE_PIN_SUCCESS
        } else if (res.getCode() == "9B01") {
            // V1 Lite Pin error
            printLog(TAG, "--- verify error")
            retryNumCommandAndReset()
        } else if (res.getCode() == "6983") {
            // V2 Lite Locked
            printLog(TAG, "--- verify Too many errors, Locked")
            resetCard()
        } else {
            if (res.getCode().startsWith("63C")) {
                return res.sw2.toInt() and 0x0F
            }
            retryNumCommandAndReset()
        }
    }

    fun startVerifyPin(pin: String): Int {
        printLog(TAG, "---> startVerifyPin begin")
        val pinHex = HexUtils.stringToHexString(pin)
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.VERIFY_PIN, hasOpenSafeChannel, "06$pinHex"
        )
        val res = command.send(this)
        printLog(TAG, "<--- startVerifyPin end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        return if (res.isConnectFailure()) {
            NfcConstant.INTERRUPT_STATUS
        } else if (res.isSuccess()) {
            printLog(TAG, "--- verify success")
            NfcConstant.VERIFY_SUCCESS
        } else if (res.getCode() == "9B01") {
            // V1 Lite Pin error
            printLog(TAG, "--- verify error")
            retryNumCommandAndReset()
        } else if (res.getCode() == "6983") {
            // V2 Lite Locked
            printLog(TAG, "--- verify Too many errors, Locked")
            resetCard()
        } else {
            if (res.getCode().startsWith("63C")) {
                return res.sw2.toInt() and 0x0F
            }
            retryNumCommandAndReset()
        }
    }

    fun backupData(mnemonic: String): Boolean {
        printLog(TAG, "---> backupData begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.BACKUP_DATA, hasOpenSafeChannel, mnemonic
        )
        val res = command.send(this)
        printLog(TAG, "<--- backupData end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        if (!res.isSuccess()) {
            return false
        }

        return true
    }

    fun exportData(): String? {
        printLog(TAG, "---> exportData begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.EXPORT_DATA, hasOpenSafeChannel
        )
        val res = command.send(this)
        printLog(
            TAG,
            "<--- exportData end: ${res.getCode()} emptyData:${res.isEmptyData()} area:${mCommandArea}"
        )

        if (res.isEmptyData() || !res.isSuccess()) {
            return null
        }

        return res.result
    }

    private fun retryNumCommandAndReset(): Int {
        val leftRetryNum = getRetryCount()
        return if (leftRetryNum == 0) {
            resetCard()
        } else {
            leftRetryNum
        }
    }

    fun resetCard(): Int {
        printLog(TAG, "---> resetCard begin")
        val command = mCommandGenerator.generalCommand(
            mCardType, CommandType.RESET_CARD, hasOpenSafeChannel, "DFFE028205"
        )
        val res = command.send(this)

        printLog(TAG, "<--- resetCard end: ${res.getCode()} ${res.data} area:${mCommandArea}")

        return if (res.isConnectFailure()) {
            NfcConstant.RESET_INTERRUPT_STATUS
        } else {
            NfcConstant.RESET_PIN_SUCCESS
        }
    }
}