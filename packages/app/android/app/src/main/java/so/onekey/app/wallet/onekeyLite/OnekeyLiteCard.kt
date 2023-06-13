package so.onekey.app.wallet.onekeyLite

import android.app.Activity
import android.nfc.tech.IsoDep
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.nfc.NfcUtils
import so.onekey.app.wallet.onekeyLite.entitys.CardState
import so.onekey.app.wallet.onekeyLite.nfc.AppleCardType
import so.onekey.app.wallet.onekeyLite.nfc.Connection
import so.onekey.app.wallet.onekeyLite.nfc.CommandGenerator
import so.onekey.app.wallet.utils.LogUtil.printLog
import so.onekey.app.wallet.utils.NfcPermissionUtils

object OneKeyLiteCard {
    const val TAG = "OneKeyLiteCard"

    private val mCommandGenerator by lazy(LazyThreadSafetyMode.NONE) {
        CommandGenerator()
    }
    private var mCardConnection: Connection? = null

    suspend fun startNfc(activity: FragmentActivity, callback: ((Boolean) -> Unit)? = null) =
        withContext(Dispatchers.Main) {
            if (NfcUtils.isNfcExits(activity)) {
                val adapter = NfcUtils.init(activity)
                if (adapter == null) {
                    printLog(TAG, "startNfc: NfcAdapter is null")
                    callback?.invoke(false)
                    return@withContext
                }
            }
            printLog(TAG, "startNfc: ${NfcUtils.isNfcExits(activity)}")

            NfcPermissionUtils.checkPermission(activity) {
                printLog(TAG, "startNfc Have permission")

                NfcUtils.mNfcAdapter?.enableForegroundDispatch(
                    activity, NfcUtils.mPendingIntent, NfcUtils.mIntentFilter, NfcUtils.mTechList
                )

                printLog(TAG, "startNfc: enableForegroundDispatch")

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
    suspend fun initRequest(isoDep: IsoDep?) = withContext(Dispatchers.IO) {
        if (isoDep == null) {
            throw NFCExceptions.ConnectionFailException()
        }
        mCardConnection = Connection(isoDep, mCommandGenerator)
        return@withContext mCardConnection?.getCardInfo()
            ?: throw NFCExceptions.InitChannelException()
    }

    @Throws(NFCExceptions::class)
    private fun setupNewPinRequest(isoDep: IsoDep, pin: String?): Boolean {
        if (pin.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        return mCardConnection?.setupNewPin(pin) ?: false
    }

    @Throws(NFCExceptions::class)
    fun changePinRequest(isoDep: IsoDep, oldPwd: String?, newPwd: String?): Int {
        if (oldPwd.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        return mCardConnection?.changePin(oldPwd, newPwd) ?: 0
    }

    @Throws(NFCExceptions::class)
    fun verifyPinBackupRequest(isoDep: IsoDep, verifyPin: String?): Int {
        if (verifyPin.isNullOrEmpty()) {
            throw NFCExceptions.InputPasswordEmptyException()
        }
        return mCardConnection?.startVerifyPin(verifyPin) ?: 0
    }

    @Throws(NFCExceptions::class)
    fun getCardName(isoDep: IsoDep): String {
        val cardInfo = mCardConnection?.getSerialNumber()
        if (cardInfo.isNullOrEmpty() || cardInfo == NfcConstant.NOT_MATCH_DEVICE) {
            throw NFCExceptions.InterruptException()
        }
        return cardInfo
    }

    @Throws(NFCExceptions::class)
    fun getCardInfo(isoDep: IsoDep): CardState {
        return mCardConnection?.getCardInfo() ?: throw NFCExceptions.ConnectionFailException()
    }

    @Throws(NFCExceptions::class)
    fun setMnemonic(
        cardState: CardState?,
        isoDep: IsoDep,
        mnemonic: String,
        pwd: String,
        overwrite: Boolean = false
    ): Boolean {
        if (cardState == null) throw NFCExceptions.ConnectionFailException()

        printLog(TAG, "--> setMnemonic: cardState:${Gson().toJson(cardState)}")

        if (!overwrite) {
            // 不是覆写要验证是否已经已经存有备份
            if (!cardState.isNewCard || cardState.hasBackup) {
                throw NFCExceptions.InitializedException()
            }
        }

        if (overwrite && mCardConnection?.getCardType() == AppleCardType.V2) {
            // Verify the password before clearing the card
            val verifyPin = verifyPinBackupRequest(isoDep, pwd)
            if (verifyPin != NfcConstant.VERIFY_SUCCESS) {
                handlerVerifyPinError(cardState, verifyPin)
            }

            // 如果是覆写,并且是V2卡,直接使用 setupNewPinRequest 清空卡片
            cardState.isNewCard = true
        }

        if (cardState.isNewCard) {
            // 如果是新卡设置密码
            if (!setupNewPinRequest(isoDep, pwd)) {
                throw NFCExceptions.InitPasswordException()
            }
        }

        val verifyPin = verifyPinBackupRequest(isoDep, pwd)
        if (verifyPin != NfcConstant.VERIFY_SUCCESS) {
            if (overwrite) {
                handlerVerifyPinError(cardState, verifyPin)
            } else {
                throw NFCExceptions.InitPasswordException()
            }
        }

        return mCardConnection?.backupData(mnemonic) == true
    }

    @Throws(NFCExceptions::class)
    fun getMnemonicWithPin(cardState: CardState?, isoDep: IsoDep, pwd: String): String {
        if (cardState == null) throw NFCExceptions.ConnectionFailException()

        if (cardState.isNewCard || !cardState.hasBackup) {
            throw NFCExceptions.NotInitializedException()
        }

        val verifyPin = verifyPinBackupRequest(isoDep, pwd)
        if (verifyPin != NfcConstant.VERIFY_SUCCESS) {
            handlerVerifyPinError(cardState, verifyPin)
        }

        val result = mCardConnection?.exportData()

        if (result.isNullOrEmpty()) {
            throw NFCExceptions.NotInitializedException()
        }
        return result
    }

    @Throws(NFCExceptions::class)
    fun changPin(cardState: CardState?, isoDep: IsoDep, oldPwd: String, newPwd: String): Boolean {
        if (cardState == null) throw NFCExceptions.ConnectionFailException()

        if (cardState.isNewCard || !cardState.hasBackup) {
            throw NFCExceptions.NotInitializedException()
        }

        val result = changePinRequest(isoDep, oldPwd, newPwd)
        handlerVerifyPinError(cardState, result, true)

        return when (result) {
            NfcConstant.CHANGE_PIN_SUCCESS -> {
                true
            }
            NfcConstant.CHANGE_PIN_ERROR -> {
                false
            }
            else -> {
                // 密码错误
                cardState.pinRetryCount = result
                throw NFCExceptions.PasswordWrongException()
            }
        }
    }

    fun reset(isoDep: IsoDep): Boolean {
        return mCardConnection?.resetCard() == NfcConstant.RESET_PIN_SUCCESS
    }

    private fun handlerVerifyPinError(
        cardState: CardState, status: Int, ignoreDefault: Boolean = false
    ) {
        when (status) {
            NfcConstant.RESET_INTERRUPT_STATUS -> {
                // Reset 卡片错误,已经锁定
                throw NFCExceptions.CardLockException()
            }
            NfcConstant.GET_RETRY_NUM_INTERRUPT_STATUS -> {
                // 密码错误
                cardState.pinRetryCount = cardState.pinRetryCount - 1
                if (cardState.pinRetryCount <= 0) {
                    throw NFCExceptions.CardLockException()
                } else {
                    throw NFCExceptions.PasswordWrongException()
                }
            }
            NfcConstant.RESET_PIN_SUCCESS -> {
                // Reset 卡片成功
                throw NFCExceptions.UpperErrorAutoResetException()
            }
            NfcConstant.INTERRUPT_STATUS -> {
                throw NFCExceptions.ConnectionFailException()
            }
            else -> {
                if (!ignoreDefault) {
                    // 密码错误
                    cardState.pinRetryCount = status
                    throw NFCExceptions.PasswordWrongException()
                }
            }
        }
    }
}