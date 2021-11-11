package so.onekey.app.wallet.keys

import android.content.Context

class KeysNativeProvider {
    companion object {
        init {
            System.loadLibrary("keys")
        }
    }

    external fun getLiteSecureChannelInitParams(context: Context): String
}