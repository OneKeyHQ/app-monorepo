package so.onekey.app.wallet.onekeyLite.entitys

import android.nfc.tech.IsoDep

data class CardState(
        var hasBackup: Boolean = false,
        var isNewCard: Boolean = true,
        var serialNum: String = "",
        var pinRetryCount: Int = 0
)
