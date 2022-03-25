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
import so.onekey.app.wallet.reactModule.OKLiteManager
import so.onekey.app.wallet.utils.HexUtils
import so.onekey.app.wallet.utils.NfcPermissionUtils

object OnekeyLiteCard {
    const val TAG = "OnekeyLiteCard"


    suspend fun startNfc(activity: FragmentActivity, callback: ((Boolean) -> Unit)? = null) =
        withContext(Dispatchers.Main) {
            if (NfcUtils.isNfcExits(activity)) {
                val adapter = NfcUtils.init(activity)
                if (adapter == null) {
                    Log.d(TAG, "startNfc: NfcAdapter is null")
                    callback?.invoke(false)
                    return@withContext
                }
            }
            Log.d(TAG, "startNfc: ${NfcUtils.isNfcExits(activity)}")

            NfcPermissionUtils.checkPermission(activity) {
                Log.d(TAG, "startNfc Have permission")

                NfcUtils.mNfcAdapter?.enableForegroundDispatch(
                    activity, NfcUtils.mPendingIntent, NfcUtils.mIntentFilter, NfcUtils.mTechList
                )

                Log.d(TAG, "startNfc: enableForegroundDispatch")

                callback?.invoke(true)
                return@withContext
            }
            Log.e(TAG, "startNfc Not NFC permission")
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

    suspend fun startConnectCommand(isoDep: IsoDep, startConnected: Boolean = true) =
        withContext(Dispatchers.IO) {
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
    fun changePinRequest(isoDep: IsoDep, oldPwd: String?, newPwd: String?): Int {
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
    fun setMnemonic(
        cardState: CardState?,
        isoDep: IsoDep,
        mnemonic: String,
        pwd: String,
        overwrite: Boolean = false,
        isBackup: Boolean = true
    ): Boolean {
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
        Log.d("verifyPinBackupRequest", "getMnemonicWithPin ${verifyPin}")
        if (verifyPin != NfcCommand.VERIFY_SUCCESS) {
            if (overwrite) {
                when (verifyPin) {
                    NfcCommand.RESET_INTERRUPT_STATUS -> {
                        // Reset 卡片错误,已经锁定
                        throw NFCExceptions.CardLockException()
                    }
                    NfcCommand.GET_RETRY_NUM_INTERRUPT_STATUS -> {
                        // 密码错误
                        cardState.pinRetryCount = cardState.pinRetryCount - 1
                        if (cardState.pinRetryCount <= 0) {
                            throw NFCExceptions.CardLockException()
                        } else {
                            throw NFCExceptions.PasswordWrongException()
                        }
                    }
                    NfcCommand.RESET_PIN_SUCCESS -> {
                        // Reset 卡片成功
                        throw NFCExceptions.UpperErrorAutoResetException()
                    }
                    NfcCommand.INTERRUPT_STATUS -> {
                        throw NFCExceptions.ConnectionFailException()
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
        Log.d("verifyPinBackupRequest", "getMnemonicWithPin ${verifyPin}")
        if (verifyPin != NfcCommand.VERIFY_SUCCESS) {
            when (verifyPin) {
                NfcCommand.RESET_INTERRUPT_STATUS -> {
                    // Reset 卡片错误,已经锁定
                    throw NFCExceptions.CardLockException()
                }
                NfcCommand.GET_RETRY_NUM_INTERRUPT_STATUS -> {
                    // 密码错误
                    cardState.pinRetryCount = cardState.pinRetryCount - 1
                    if (cardState.pinRetryCount <= 0) {
                        throw NFCExceptions.CardLockException()
                    } else {
                        throw NFCExceptions.PasswordWrongException()
                    }
                }
                NfcCommand.RESET_PIN_SUCCESS -> {
                    // Reset 卡片成功
                    throw NFCExceptions.UpperErrorAutoResetException()
                }
                NfcCommand.INTERRUPT_STATUS -> {
                    throw NFCExceptions.ConnectionFailException()
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

        when (val result = changePinRequest(isoDep, oldPwd, newPwd)) {
            NfcCommand.RESET_INTERRUPT_STATUS -> {
                // Reset 卡片错误,已经锁定
                throw NFCExceptions.CardLockException()
            }
            NfcCommand.GET_RETRY_NUM_INTERRUPT_STATUS -> {
                // 密码错误
                cardState.pinRetryCount = cardState.pinRetryCount - 1
                if (cardState.pinRetryCount <= 0) {
                    throw NFCExceptions.CardLockException()
                } else {
                    throw NFCExceptions.PasswordWrongException()
                }
            }
            NfcCommand.CHANGE_PIN_SUCCESS -> {
                return true
            }
            NfcCommand.CHANGE_PIN_ERROR -> {
                return false
            }
            NfcCommand.RESET_PIN_SUCCESS -> {
                // Reset 卡片成功
                throw NFCExceptions.UpperErrorAutoResetException()
            }
            NfcCommand.INTERRUPT_STATUS -> {
                throw NFCExceptions.ConnectionFailException()
            }
            else -> {
                // 密码错误
                cardState.pinRetryCount = result
                throw NFCExceptions.PasswordWrongException()
            }
        }
    }

    fun reset(isoDep: IsoDep): Boolean {
        return NfcCommand.resetCommand(isoDep) == NfcCommand.RESET_PIN_SUCCESS
    }
}