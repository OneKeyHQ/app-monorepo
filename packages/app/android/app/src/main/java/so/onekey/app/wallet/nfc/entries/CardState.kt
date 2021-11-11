package so.onekey.app.wallet.nfc.entries

import android.nfc.tech.IsoDep

data class CardState(
        val isoDep: IsoDep,
        var hasBackup: Boolean = false,
        var isNewCard: Boolean = true,
        var serialNum: String = ""
)
