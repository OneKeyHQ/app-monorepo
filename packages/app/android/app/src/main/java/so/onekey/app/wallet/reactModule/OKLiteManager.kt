package so.onekey.app.wallet.reactModule

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModelProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import so.onekey.app.wallet.MainApplication
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.nfc.OnekeyLiteCard
import so.onekey.app.wallet.utils.Utils
import so.onekey.app.wallet.viewModel.NfcViewModel
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

    private val mNFCConnectedChannel = Channel<IsoDep>(1)
    private val mShowDialogNumber = AtomicInteger(0)
    private val mNfcViewModel by lazy {
        ViewModelProvider(Utils.getApp() as MainApplication).get(NfcViewModel::class.java)
    }

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
                    try {
                        val startRequest = mNfcViewModel.startRequest(isoDep)
                                ?: throw NFCExceptions.InitChannelException()
                        mNFCConnectedChannel.trySend(startRequest.isoDep)
                        delay(100)
                        if (!mNFCConnectedChannel.isEmpty) {
                            Log.e(TAG, "There is no way to use NFC")
                            mNFCConnectedChannel.receive()
                            val dataMap = Arguments.createMap().apply {
                                putString("type", "OneKey_Lite")
                                putString("serialNum", startRequest.serialNum)
                                putBoolean("isNewCard", startRequest.isNewCard)
                                putBoolean("hasBackup", startRequest.hasBackup)
                            }
                            sendEvent(context, NFC_ACTIVE_CONNECTION, dataMap)
                        }
                    } catch (e: Exception) {
                        // 未知设备或连接失败
                        val dataMap = Arguments.createMap().apply {
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
                    mNfcViewModel.initialize()
                }
            }
        }
    }

    override fun onHostPause() {
        Utils.getTopActivity()?.let {
            launch(Dispatchers.Main) {
                OnekeyLiteCard.stopNfc(it as FragmentActivity)
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

    private suspend fun acquireDevice(): IsoDep {
        // 展示连接 ui
        sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
            it.putString("state", "show_connect_ui")
        })
        mShowDialogNumber.incrementAndGet()
        val receive = mNFCConnectedChannel.receive()
        // 展示连接结束 ui
        sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
            it.putString("state", "connected")
        })
        return receive
    }

    private fun releaseDevice() {
        val decrementAndGet = mShowDialogNumber.decrementAndGet()
        // 关闭连接结束 ui
        sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
            it.putString("state", "close_connect_ui")
        })

        // 还有需要处理的 NFC 事件
        if (decrementAndGet > 0) {
            // 展示连接 ui
            sendEvent(context, NFC_UI_EVENT, Arguments.createMap().also {
                it.putString("state", "show_connect_ui")
            })
        }
    }

    private fun isTargetDevice(cardId: String): Boolean {
        return cardId == mNfcViewModel.cardState.value?.serialNum
    }

    private suspend fun <T> handleOperation(
            callback: Callback,
            execute: (isoDep: IsoDep) -> T
    ) {
        val isoDep = acquireDevice()
        try {
            val executeResult = execute(isoDep)
            callback.invoke(null, executeResult)
        } catch (e: NFCExceptions) {
            callback.invoke(e.toJson(), null)
        }
        releaseDevice()
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
