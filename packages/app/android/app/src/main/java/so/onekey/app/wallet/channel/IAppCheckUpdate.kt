package so.onekey.app.wallet.channel

import androidx.annotation.IntDef


@IntDef(AppUpdateTypes.RECOMMEND, AppUpdateTypes.IMMEDIATELY, AppUpdateTypes.FORCE)
annotation class AppUpdateTypes {
    companion object {
        const val RECOMMEND = 0
        const val IMMEDIATELY = 1
        const val FORCE = 2
    }
}

interface IAppCheckUpdate {
    fun checkAppUpdate(callback: ((Int) -> Unit))
}