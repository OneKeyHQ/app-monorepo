package so.onekey.app.wallet.reactModule

import androidx.annotation.IntDef

@IntDef(AppUpdateType.IMMEDIATE, AppUpdateType.FLEXIBLE)
annotation class AppUpdateType {
    companion object {
        const val FLEXIBLE = 0
        const val IMMEDIATE = 1
    }
}