package so.onekey.app.wallet.viewModel

import android.nfc.tech.IsoDep
import androidx.annotation.IntDef
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import so.onekey.app.wallet.nfc.OnekeyLiteCard
import so.onekey.app.wallet.nfc.entries.CardState

class NfcViewModel : ViewModel() {
    @IntDef(LiteCardStatus.Idle, LiteCardStatus.StartConnect, LiteCardStatus.Connected, LiteCardStatus.ProgressConnect, LiteCardStatus.ProgressBackup)
    annotation class LiteCardStatus {
        companion object {
            const val Idle = -1
            const val StartConnect = 0
            const val ProgressConnect = 1
            const val Connected = 2
            const val ProgressBackup = 3
        }
    }
    
    val cardState: MutableLiveData<CardState> = MutableLiveData()
    val currentProgressStatus = MutableLiveData(LiteCardStatus.Idle)

    fun initialize() {
        currentProgressStatus.value = LiteCardStatus.StartConnect
    }

    suspend fun startRequest(isoDep: IsoDep): CardState? {
        try {
            return when (currentProgressStatus.value) {
                LiteCardStatus.StartConnect -> {
                    initChannelRequest(isoDep)
                }
                LiteCardStatus.ProgressConnect -> {
                    startRequestCommand(isoDep)
                }
                else -> null
            }.also {
                withContext(Dispatchers.Main) {
                    cardState.value = it
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    private suspend fun initChannelRequest(isoDep: IsoDep): CardState {
        return OnekeyLiteCard.initChannelRequest(isoDep)
    }

    private suspend fun startRequestCommand(isoDep: IsoDep): CardState? {
        return OnekeyLiteCard.startConnectCommand(isoDep)
    }
}