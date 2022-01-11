package so.onekey.app.wallet.onekeyLite.entitys

import android.nfc.tech.IsoDep

data class CardState(
        val isoDep: IsoDep,
        var hasBackup: Boolean = false,
        var isNewCard: Boolean = true,
        var serialNum: String = ""
)
