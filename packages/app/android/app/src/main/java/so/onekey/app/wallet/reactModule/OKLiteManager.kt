package so.onekey.app.wallet.reactModule

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import androidx.annotation.IntDef
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.nfc.OnekeyLiteCard
import so.onekey.app.wallet.nfc.entries.CardState
import so.onekey.app.wallet.utils.Utils
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import javax.annotation.Nullable


public fun NFCScope(): CoroutineScope = CoroutineScope(SupervisorJob() + NFCDispatcher)
private val NFCDispatcher = Executors.newFixedThreadPool(1).asCoroutineDispatcher()

class OKLiteManager(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener, CoroutineScope by NFCScope() {
    companion object {
        private val TAG = OKLiteManager::class.simpleName

        // NFC UI 事件
        private const val NFC_UI_EVENT = "nfc_ui_event"

        // NFC 主动连接
        private const val NFC_ACTIVE_CONNECTION = "nfc_active_connection"
    }

    @IntDef(NFCState.Dead, NFCState.Started)
    annotation class NFCState {
        companion object {
            const val Dead = -1
            const val Started = 0
        }
    }

    private val mNFCConnectedChannel = Channel<IsoDep?>(1)
    private val mNFCState = AtomicInteger(NFCState.Dead)
    private val mShowDialogNumber = AtomicInteger(0)
    private var mCurrentCardState: CardState? = null

    private val mActivityEventListener = object : BaseActivityEventListener() {
        override fun onNewIntent(intent: Intent?) {
            super.onNewIntent(intent)
            val action = intent?.action
            if ((action == NfcAdapter.ACTION_NDEF_DISCOVERED)
                    || (action == NfcAdapter.ACTION_TECH_DISCOVERED)
                    || action == NfcAdapter.ACTION_TAG_DISCOVERED) {
                val tags = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)
                val isoDep: IsoDep? = IsoDep.get(tags)
                if (isoDep == null) {
                    // 未知设备
                    val dataMap = Arguments.createMap().apply {
                        putString("type", "unknown")
                    }
                    sendEvent(context, NFC_ACTIVE_CONNECTION, dataMap)
                    return
                }

                Log.e(OnekeyLiteCard.TAG, isoDep.toString())
                launch(Dispatchers.IO) {
                    mNFCConnectedChannel.trySend(isoDep)
                    try {
                        // 处理主动触发 NFC
                        delay(100)
                        if (!mNFCConnectedChannel.isEmpty) {
                            Log.e(TAG, "There is no way to use NFC")
                            mNFCConnectedChannel.receive()
                            val startRequest = OnekeyLiteCard.initChannelRequest(isoDep)
                            val dataMap = Arguments.createMap().apply {
                                putInt("code", -1)
                                putString("type", "OneKey_Lite")
                                putString("serialNum", startRequest.serialNum)
                                putBoolean("isNewCard", startRequest.isNewCard)
                                putBoolean("hasBackup", startRequest.hasBackup)
                            }
                            sendEvent(context, NFC_ACTIVE_CONNECTION, dataMap)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        // 未知设备或连接失败
                        val dataMap = Arguments.createMap().apply {
                            putInt("code", -1)
                            putString("type", "unknown")
                        }
                        sendEvent(context, NFC_ACTIVE_CONNECTION, dataMap)
                    }
                }
            }
        }
    }

    init {
        context.addLifecycleEventListener(this)
        context.addActivityEventListener(mActivityEventListener)
    }

    override fun getName() = "OKLiteManager"

    override fun onHostResume() {
        Utils.getTopActivity()?.let {
            launch(Dispatchers.Main) {
                if (it !is FragmentActivity) return@launch

                OnekeyLiteCard.startNfc(it) {
                    mNFCState.set(NFCState.Started)
                }
            }
        }
    }

    override fun onHostPause() {
        Utils.getTopActivity()?.let {
            launch(Dispatchers.IO) {
                try {
                    OnekeyLiteCard.stopNfc(it as FragmentActivity)
                    mNFCState.set(NFCState.Dead)
                }catch (e:Exception){
                    e.printStackTrace()
                }
            }
        }
    }

    override fun onHostDestroy() {
    }

    private fun sendEvent(reactContext: ReactContext,
                          eventName: String,
                          @Nullable params: WritableMap) {
        reactContext
                .getJSModule(RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
    }

    @Throws(NFCExceptions::class)
    private suspend fun acquireDevice(): IsoDep? {
        // 展示连接 ui
        sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
            it.putInt("code", 1)
            it.putString("message", "show_connect_ui")
        })
        mShowDialogNumber.incrementAndGet()
        if (!mNFCConnectedChannel.isEmpty) {
            mNFCConnectedChannel.tryReceive()
        }
        val receiveIsoDep = mNFCConnectedChannel.receive()
        mCurrentCardState = null
        if (receiveIsoDep == null) {
            // 取消连接
            releaseDevice()
        } else {
            val initChannelRequest = OnekeyLiteCard.initChannelRequest(receiveIsoDep)

            mCurrentCardState = initChannelRequest

            // 展示连接结束 ui
            sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
                it.putInt("code", 2)
                it.putString("message", "connected")
            })
        }
        return receiveIsoDep
    }

    private fun releaseDevice() {
        if (mShowDialogNumber.get() <= 0) return

        mCurrentCardState = null
        val decrementAndGet = mShowDialogNumber.decrementAndGet()

        // 关闭连接结束 ui
        sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
            it.putInt("code", 3)
            it.putString("message", "close_connect_ui")
        })

        // 还有需要处理的 NFC 事件
        if (decrementAndGet > 0) {
            // 展示连接 ui
            sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
                it.putInt("code", 1)
                it.putString("message", "show_connect_ui")
            })
        }
    }

    private fun isTargetDevice(cardId: String): Boolean {
        return cardId == mCurrentCardState?.serialNum
    }

    private suspend fun <T> handleOperation(
            callback: Callback,
            execute: (isoDep: IsoDep) -> T
    ) {
        try {
            val isoDep = acquireDevice() ?: return
            val executeResult = execute(isoDep)
            callback.invoke(null, executeResult)
        } catch (e: NFCExceptions) {
            callback.invoke(e.toJson(), null)
        }
        releaseDevice()
    }

    @ReactMethod
    fun cancel() {
        if (mNFCConnectedChannel.isEmpty) {
            mNFCConnectedChannel.trySend(null)
        }
    }

    @ReactMethod
    fun getLiteInfo(cardId: String, callback: Callback) = launch {
        Log.e(TAG, "getLiteInfo $cardId")
        handleOperation(callback) { isoDep ->
            Log.e(TAG, "getLiteInfo Obtain the device")
            val cardInfo = OnekeyLiteCard.getCardName(isoDep)
            if (!isTargetDevice(cardId)) {
                throw NFCExceptions.DeviceMismatchException()
            }
            Log.e(TAG, "getLiteInfo result $cardInfo")
            cardInfo
        }
    }

    @ReactMethod
    fun setMnemonic(mnemonic: String, pwd: String, callback: Callback) = launch {
        Log.e(TAG, "setMnemonic $mnemonic")
        handleOperation(callback) { isoDep ->
            Log.e(TAG, "setMnemonic Obtain the device")
            val isSuccess = OnekeyLiteCard.setMnemonic(isoDep, mnemonic, pwd)
            if (!isSuccess) throw NFCExceptions.ExecFailureException()
            Log.e(TAG, "setMnemonic result $isSuccess")
            isSuccess
        }
    }

    @ReactMethod
    fun getMnemonicWithPin(pwd: String, callback: Callback) = launch {
        Log.e(TAG, "getMnemonicWithPin")
        handleOperation(callback) { isoDep ->
            Log.e(TAG, "getMnemonicWithPin Obtain the device")
            OnekeyLiteCard.getMnemonicWithPin(isoDep, pwd)
        }
    }

    @ReactMethod
    fun reset(callback: Callback) = launch {
        Log.e(TAG, "reset")
        handleOperation(callback) { isoDep ->
            Log.e(TAG, "reset Obtain the device")
            val isSuccess = OnekeyLiteCard.reset(isoDep)
            if (!isSuccess) throw NFCExceptions.ExecFailureException()
            Log.e(TAG, "reset result $isSuccess")
            isSuccess
        }
    }
}
