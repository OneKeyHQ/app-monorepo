package so.onekey.app.wallet.reactModule

import androidx.annotation.IntDef

@IntDef(InstallState.UNKNOWN, InstallState.PENDING, InstallState.DOWNLOADING, InstallState.DOWNLOADED, InstallState.INSTALLING, InstallState.INSTALLED, InstallState.FAILED, InstallState.CANCELED)
annotation class InstallState {
    companion object {
        const val UNKNOWN = 0
        const val PENDING = 1
        const val DOWNLOADING = 2
        const val DOWNLOADED = 11
        const val INSTALLING = 3
        const val INSTALLED = 4
        const val FAILED = 5
        const val CANCELED = 6
    }
}