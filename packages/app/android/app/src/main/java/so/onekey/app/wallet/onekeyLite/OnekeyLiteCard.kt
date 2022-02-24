package so.onekey.app.wallet.onekeyLite

import android.app.Activity
import android.nfc.tech.IsoDep
import android.util.Log
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.nfc.NfcUtils
import so.onekey.app.wallet.onekeyLite.entitys.CardState
import so.onekey.app.wallet.utils.HexUtils
import so.onekey.app.wallet.utils.NfcPermissionUtils

object OnekeyLiteCard {
    const val TAG = "OnekeyLiteCard"


    suspend fun startNfc(activity: FragmentActivity, callback: ((Boolean) -> Unit)? = null) = withContext(Dispatchers.Main) {
        if (NfcUtils.isNfcExits(activity)) {
            NfcUtils.init(activity)
        }

        NfcPermissionUtils.checkPermission(activity) {
            NfcUtils.mNfcAdapter?.enableForegroundDispatch(
                    activity, NfcUtils.mPendingIntent, NfcUtils.mIntentFilter, NfcUtils.mTechList
            )
            callback?.invoke(true)
            return@withContext
        }
        callback?.invoke(false)
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

        return@withContext getCardInfo(isoDep)
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
    fun changePinRequest(isoDep: IsoDep, oldPwd: String?, newPwd: String?): Boolean {
        if (oldPwd.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        val verifyPinInitCommand = NfcCommand.verifyPinInitCommand(isoDep)
        if (!verifyPinInitCommand) {
            throw NFCExceptions.InterruptException()
        }

        return NfcCommand.changePinCommand(isoDep, oldPwd, newPwd)
    }

    @Throws(NFCExceptions::class)
    fun verifyPinBackupRequest(isoDep: IsoDep, verifyPin: String?): Int {
        if (verifyPin.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        val verifyPinInitCommand = NfcCommand.verifyPinInitCommand(isoDep)
        if (!verifyPinInitCommand) {
            throw NFCExceptions.InterruptException()
        }

        return NfcCommand.startVerifyPinCommand(isoDep, verifyPin)
    }

    @Throws(NFCExceptions::class)
    fun getCardName(isoDep: IsoDep): String {
        val cardInfo = NfcCommand.getCardName(isoDep)
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

        val pinRetryCount = NfcCommand.getRetryCount(isoDep)

        return CardState(hasBackup, needNewPIN, serialNum, pinRetryCount)
    }

    @Throws(NFCExceptions::class)
    fun setMnemonic(cardState: CardState?, isoDep: IsoDep, mnemonic: String, pwd: String, overwrite: Boolean = false, isBackup: Boolean = true): Boolean {
        if (cardState == null) throw  NFCExceptions.ConnectionFailException()

        if (!overwrite) {
            // 不是覆写要验证是否已经已经存有备份
            if (!cardState.isNewCard || (!cardState.isNewCard && cardState.hasBackup)) {
                throw NFCExceptions.InitializedException()
            }
        }
        if (cardState.isNewCard) {
            // 如果是新卡设置密码
            if (!setPinBackupRequest(isoDep, pwd)) {
                throw NFCExceptions.InitPasswordException()
            }
        }
        val verifyPin = verifyPinBackupRequest(isoDep, pwd)
        Log.d("verifyPinBackupRequest","getMnemonicWithPin ${verifyPin}")
        if (verifyPin != NfcCommand.VERIFY_SUCCESS) {
            if (overwrite) {
                when (verifyPin) {
                    NfcCommand.INTERRUPT_STATUS -> {
                        // Reset 卡片错误,已经锁定
                        throw NFCExceptions.CardLockException()
                    }
                    NfcCommand.RESET_PIN_SUCCESS -> {
                        // Reset 卡片成功
                        throw NFCExceptions.UpperErrorAutoResetException()
                    }
                    else -> {
                        // 密码错误
                        cardState.pinRetryCount = verifyPin
                        throw NFCExceptions.PasswordWrongException()
                    }
                }
            } else {
                throw NFCExceptions.InitPasswordException()
            }
        }
        return NfcCommand.startBackupCommand(isoDep, isBackup, mnemonic)
    }

    @Throws(NFCExceptions::class)
    fun getMnemonicWithPin(cardState: CardState?, isoDep: IsoDep, pwd: String): String {
        if (cardState == null) throw  NFCExceptions.ConnectionFailException()

        if (cardState.isNewCard || (!cardState.isNewCard && !cardState.hasBackup)) {
            throw NFCExceptions.NotInitializedException()
        }

        val verifyPin = verifyPinBackupRequest(isoDep, pwd)
        Log.d("verifyPinBackupRequest","getMnemonicWithPin ${verifyPin}")
        if (verifyPin != NfcCommand.VERIFY_SUCCESS) {
            when (verifyPin) {
                NfcCommand.INTERRUPT_STATUS -> {
                    // Reset 卡片错误,已经锁定
                    throw NFCExceptions.CardLockException()
                }
                NfcCommand.RESET_PIN_SUCCESS -> {
                    // Reset 卡片成功
                    throw NFCExceptions.UpperErrorAutoResetException()
                }
                else -> {
                    // 密码错误
                    cardState.pinRetryCount = verifyPin
                    throw NFCExceptions.PasswordWrongException()
                }
            }
        }

        val result = NfcCommand.exportCommand(isoDep)

        if (result.isNullOrEmpty()) {
            throw NFCExceptions.NotInitializedException()
        }
        return result
    }

    @Throws(NFCExceptions::class)
    fun changPin(cardState: CardState?, isoDep: IsoDep, oldPwd: String, newPwd: String): Boolean {
        if (cardState == null) throw  NFCExceptions.ConnectionFailException()

        if (cardState.isNewCard || (!cardState.isNewCard && !cardState.hasBackup)) {
            throw NFCExceptions.NotInitializedException()
        }

        return changePinRequest(isoDep, oldPwd, newPwd)
    }

    fun reset(isoDep: IsoDep): Boolean {
        return NfcCommand.resetCommand(isoDep) == NfcCommand.RESET_PIN_SUCCESS
    }
}