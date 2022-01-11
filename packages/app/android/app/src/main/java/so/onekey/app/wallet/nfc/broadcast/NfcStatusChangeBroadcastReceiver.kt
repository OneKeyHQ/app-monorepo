package so.onekey.app.wallet.nfc.broadcast

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.util.Log

open class NfcStatusChangeBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (NfcAdapter.ACTION_ADAPTER_STATE_CHANGED == action) {
            val state =
                    intent.getIntExtra(NfcAdapter.EXTRA_ADAPTER_STATE, NfcAdapter.STATE_OFF)

            Log.e(TAG, "nfc state broadcast receiver, state is $state")
            when (state) {
                NfcAdapter.STATE_OFF -> onNfcOff()
                NfcAdapter.STATE_ON -> onNfcOn()
                NfcAdapter.STATE_TURNING_OFF -> onNfcTurningOff()
                NfcAdapter.STATE_TURNING_ON -> onNfcTurningOn()
                5 -> onCardPayMode() //samsumg return 5 that minds card pay mode
                else -> onNfcOff()
            }
        }
    }

    protected open fun onNfcTurningOn() {

    }

    protected open fun onNfcTurningOff() {

    }

    protected open fun onNfcOn() {

    }

    protected open fun onNfcOff() {

    }

    protected open fun onCardPayMode() {

    }

    companion object {
        val TAG: String = NfcStatusChangeBroadcastReceiver::class.java.simpleName

        val nfcBroadcastReceiverIntentFilter: IntentFilter
            get() = IntentFilter("android.nfc.action.ADAPTER_STATE_CHANGED")
    }
}
