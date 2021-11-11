package so.onekey.app.wallet.nfc

import android.app.Activity
import android.content.Context
import android.nfc.tech.IsoDep
import android.util.Log
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import so.onekey.app.wallet.nfc.entries.CardState
import so.onekey.app.wallet.utils.HexUtils

object OnekeyLiteCard {
    private const val LITE_NFC_SUPPORT = "lite_nfc_support"
    const val TAG = "OnekeyLiteCard"

    fun isSupportLiteNfc(context: Context): Boolean {
        return context.getSharedPreferences("Preferences", Activity.MODE_PRIVATE)
                .getBoolean(LITE_NFC_SUPPORT, true)
    }

    fun setSupportLiteNfc(context: Context, enable: Boolean) {
        context.getSharedPreferences("Preferences", Activity.MODE_PRIVATE)
                .edit()
                .putBoolean(LITE_NFC_SUPPORT, enable)
                .apply()
    }

    suspend fun startNfc(activity: FragmentActivity, callback: (() -> Unit)? = null) = withContext(Dispatchers.Main) {
        if (isSupportLiteNfc(activity)) {
            NfcUtils.init(activity)
        }
        if (NfcUtils.checkPermission(activity)) {
            NfcUtils.mNfcAdapter?.enableForegroundDispatch(
                    activity, NfcUtils.mPendingIntent, NfcUtils.mIntentFilter, NfcUtils.mTechList
            )
            callback?.invoke()
        }
    }

    fun stopNfc(activity: Activity) {
        NfcUtils.mNfcAdapter?.disableForegroundDispatch(activity)
    }

    // first init channel ,can filter not match device
    @Throws(NFCExceptions::class)
    suspend fun initChannelRequest(isoDep: IsoDep?) = withContext(Dispatchers.IO) {
        if (isoDep == null) {
            throw NFCExceptions.ConnectionFailException()
        }
        return@withContext when (NfcCommand.initChannel(isoDep)) {
            NfcCommand.INIT_CHANNEL_SUCCESS -> {
                startConnectCommand(isoDep)
            }
            NfcCommand.INIT_CHANNEL_FAILURE -> {
                throw NFCExceptions.InitChannelException(NfcCommand.INIT_CHANNEL_FAILURE.toString())
            }
            else -> throw NFCExceptions.InitChannelException()
        }
    }

    suspend fun startConnectCommand(isoDep: IsoDep, startConnected: Boolean = true) = withContext(Dispatchers.IO) {
        val selected = NfcCommand.selectBackupApp(isoDep)
        if (!selected) {
            throw NFCExceptions.ConnectionFailException()
        }
        val hasBackup = hasBackup(isoDep)
        val selectIssuerSd = NfcCommand.selectIssuerSd(isoDep)
        if (!selectIssuerSd) {
            throw NFCExceptions.ConnectionFailException()
        }
        val apdu = NfcCommand.isNewCardCommand()
        val status = NfcCommand.send(isoDep, apdu)
        if (status.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }
        val needNewPIN = NfcCommand.NEW_PIN == status
        val serialNum = getCardSerialNum(isoDep)
        Log.d(TAG, "hasBack----${hasBackup}    needNewPIN-->${needNewPIN}")
        if (serialNum.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }

        return@withContext CardState(isoDep, hasBackup, needNewPIN, serialNum)
    }

    @Throws(NFCExceptions::class)
    private fun hasBackup(isoDep: IsoDep): Boolean {
        val backupStatus = NfcCommand.hasBackUpCommand()
        if (backupStatus.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }
        return NfcCommand.send(isoDep, backupStatus) == NfcCommand.HAS_BACK_UP
    }

    @Throws(NFCExceptions::class)
    private fun isNewCard(isoDep: IsoDep): Boolean {
        val apdu = NfcCommand.isNewCardCommand()
        val status = NfcCommand.send(isoDep, apdu)
        if (status.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }
        return NfcCommand.NEW_PIN == status
    }

    private fun getCardSerialNum(isoDep: IsoDep): String {
        val command = NfcCommand.getCardSerialNumCommand()
        val tempCardId = NfcCommand.send(isoDep, command)
        if (tempCardId.isNullOrEmpty() || !tempCardId.endsWith(NfcCommand.STATUS_SUCCESS) || tempCardId.length < 4) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        return String(HexUtils.hexString2Bytes(tempCardId.substring(0, tempCardId.length - 4)))
    }

    @Throws(NFCExceptions::class)
    fun setPinBackupRequest(isoDep: IsoDep, pin: String?): Boolean {
        if (pin.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        val verifyPinInitCommand = NfcCommand.verifyPinInitCommand(isoDep)
        if (!verifyPinInitCommand) {
            throw NFCExceptions.InterruptException()
        }

        return NfcCommand.setupPinCommand(isoDep, pin)
    }

    @Throws(NFCExceptions::class)
    fun verifyPinBackupRequest(isoDep: IsoDep, verifyPin: String?): Boolean {
        if (verifyPin.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        val verifyPinInitCommand = NfcCommand.verifyPinInitCommand(isoDep)
        if (!verifyPinInitCommand) {
            throw NFCExceptions.InterruptException()
        }

        return NfcCommand.startVerifyPinCommand(isoDep, verifyPin) == NfcCommand.VERIFY_SUCCESS
    }

    @Throws(NFCExceptions::class)
    fun getCardName(isoDep: IsoDep): String {
        val cardInfo = NfcCommand.getCardInfo(isoDep)
        if (cardInfo.isNullOrEmpty() || cardInfo == NfcCommand.NOT_MATCH_DEVICE) {
            throw NFCExceptions.InterruptException()
        }
        return cardInfo
    }

    @Throws(NFCExceptions::class)
    fun getCardInfo(isoDep: IsoDep): CardState {
        val hasBackup = hasBackup(isoDep)
        val selectIssuerSd = NfcCommand.selectIssuerSd(isoDep)
        if (!selectIssuerSd) {
            throw NFCExceptions.ConnectionFailException()
        }
        val apdu = NfcCommand.isNewCardCommand()
        val status = NfcCommand.send(isoDep, apdu)
        if (status.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }
        val needNewPIN = NfcCommand.NEW_PIN == status
        val serialNum = getCardSerialNum(isoDep)
        Log.d(TAG, "hasBack----${hasBackup}    needNewPIN-->${needNewPIN}")
        if (serialNum.isNullOrEmpty()) {
            throw NFCExceptions.ConnectionFailException()
        }

        return CardState(isoDep, hasBackup, needNewPIN, serialNum)
    }

    @Throws(NFCExceptions::class)
    fun setMnemonic(isoDep: IsoDep, mnemonic: String, pwd: String, isBackup: Boolean = true): Boolean {
        if (hasBackup(isoDep)) {
            throw NFCExceptions.InitializedException()
        }
        if (!isNewCard(isoDep)) {
            throw NFCExceptions.InitializedException()
        }
        if (!setPinBackupRequest(isoDep, pwd)) {
            throw NFCExceptions.PasswordWrongException()
        }
        if (!verifyPinBackupRequest(isoDep, pwd)) {
            throw NFCExceptions.PasswordWrongException()
        }
        val response = HexUtils.byteArr2HexStr(mnemonic.toByteArray());
        return NfcCommand.startBackupCommand(isoDep, isBackup, response)

        // val response = PyEnv.encodeMnemonics(mnemonic)
        //    if (response.isNullOrEmpty()) {
        //        throw NFCExceptions.InterruptException()
        //    }
        //    val meta = "${NfcCommand.LITE_TAG}${NfcCommand.LITE_VERSION}${NfcCommand.LITE_LANGUAGE}"
        //    Log.d(TAG, "--encode--->${response + meta}")
        //    return NfcCommand.startBackupCommand(isoDep, isBackup, response + meta)
    }

    @Throws(NFCExceptions::class)
    fun getMnemonicWithPin(isoDep: IsoDep, pwd: String): String {
        if (!verifyPinBackupRequest(isoDep, pwd)) {
            throw NFCExceptions.PasswordWrongException()
        }

        val result = NfcCommand.exportCommand(isoDep)
        Log.d(TAG, "export--->$result")
        if (result.isNullOrEmpty()) {
            throw NFCExceptions.NotInitializedException()
        }
        return result
    }

    fun reset(isoDep: IsoDep): Boolean {
        return NfcCommand.resetCommand(isoDep) == NfcCommand.RESET_PIN_SUCCESS
    }
}