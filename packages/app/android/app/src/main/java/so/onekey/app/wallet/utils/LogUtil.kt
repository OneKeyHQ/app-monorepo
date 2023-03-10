package so.onekey.app.wallet.utils

import android.util.Log
import so.onekey.app.wallet.onekeyLite.NfcConstant

object LogUtil {
    @JvmStatic
    fun printLog(tag: String, msg: String) {
        if (NfcConstant.DEBUG) Log.d(tag, msg)
    }
}